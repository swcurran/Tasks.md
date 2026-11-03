const fs = require("fs");
const path = require("path");
const uuid = require("uuid");
const Koa = require("koa");
const Router = require("@koa/router");
const bodyParser = require("koa-bodyparser");
const cors = require("@koa/cors");
const multer = require("@koa/multer");
const mount = require("koa-mount");
const serve = require("koa-static");

const router = new Router();

const PUID = Number(process.env.PUID || '0');
const PGID = Number(process.env.PGID || '0');
let BASE_PATH = process.env.BASE_PATH || '';
if (BASE_PATH === "/") {
  BASE_PATH = '';
}
const CONFIG_DIR = process.env.CONFIG_DIR || 'config';
const TASKS_DIR = process.env.TASKS_DIR || 'tasks';
const TITLE = process.env.TITLE || '';
const PORT = process.env.PORT || 8080;

const multerInstance = multer();

const app = new Koa();

// Reads a JSON config file (sort.json, tags.json). A missing or empty file is
// treated as empty, but any other failure (such as a corrupt file) throws, so a
// bad read is never mistaken for "no data" and then saved over the real data.
async function readConfigJson(fileName) {
  let raw;
  try {
    raw = await fs.promises.readFile(`${CONFIG_DIR}/${fileName}`, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return {};
    }
    throw err;
  }
  if (!raw.trim()) {
    return {};
  }
  const data = JSON.parse(raw);
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

// Writes a JSON config file atomically: the new content goes to a temporary
// file that is then renamed over the old one, so a concurrent read sees either
// the old or the new file, never a half-written one.
async function writeConfigJson(fileName, data) {
  const filePath = `${CONFIG_DIR}/${fileName}`;
  const tempPath = `${filePath}.${uuid.v4()}.tmp`;
  try {
    await fs.promises.writeFile(tempPath, JSON.stringify(data));
    if (PUID && PGID) {
      await fs.promises.chown(tempPath, PUID, PGID);
    }
    await fs.promises.rename(tempPath, filePath);
  } catch (err) {
    await fs.promises.rm(tempPath, { force: true });
    throw err;
  }
}

// Read-modify-write updates of each config file run one at a time, so
// concurrent requests can't drop each other's changes
const configFileUpdateQueues = new Map();
function updateConfigJson(fileName, update) {
  const previousUpdate = configFileUpdateQueues.get(fileName) || Promise.resolve();
  const nextUpdate = previousUpdate
    .catch(() => {})
    .then(async () => {
      const data = await readConfigJson(fileName);
      await writeConfigJson(fileName, update(data));
    });
  configFileUpdateQueues.set(fileName, nextUpdate);
  return nextUpdate;
}

async function getTags(ctx) {
  const subPath = decodeURIComponent(ctx.request.url.substring("/tags".length));
  const tags = await readConfigJson("tags.json");
  ctx.body = tags[subPath] || {};
  ctx.status = 200;
}

router.get("/tags/:path*", getTags);

async function updateTagBackgroundColor(ctx) {
  const subPath = decodeURIComponent(ctx.request.url.substring("/tags".length));
  const tagsColors = ctx.request.body;
  await updateConfigJson("tags.json", (tags) => ({
    ...tags,
    [subPath]: tagsColors,
  }));
  ctx.status = 204;
}

router.patch("/tags/:path*", updateTagBackgroundColor);

async function getTitle(ctx) {
  ctx.body = TITLE;
}

router.get("/title", getTitle);

async function getResource(ctx) {
  const path = ctx.request.url.substring("/resources".length);
  const resources = await fs.promises.readdir(
    `${TASKS_DIR}/${decodeURIComponent(path)}`,
    { withFileTypes: true }
  ).catch(err => {
    console.log(err.code)
    if (err.code === 'ENOENT') {
      fs.promises.mkdir(`${TASKS_DIR}/${decodeURIComponent(path)}`)
      return [];
    }
  })
  const lanes = resources
    .filter((dir) => dir.isDirectory() && !dir.name.startsWith("."))
    .map((dir) => dir.name);

  const lanesWithFiles = await Promise.all(
    lanes.map(async (lane) => {
      const filesPromises = await fs.promises
        .readdir(`${TASKS_DIR}/${decodeURIComponent(`${path}`)}/${lane}`)
        .then((files) =>
          files
            .filter(
              (fileName) =>
                fileName.endsWith(".md") && !fileName.startsWith(".")
            )
            .map(async (fileName) => {
              const getFileContent = fs.promises.readFile(
                `${TASKS_DIR}/${decodeURIComponent(
                  `${path}`
                )}/${lane}/${fileName}`
              );
              const getFileStats = fs.promises.stat(
                `${TASKS_DIR}/${decodeURIComponent(
                  `${path}`
                )}/${lane}/${fileName}`
              );
              const [content, stats] = await Promise.all([
                getFileContent,
                getFileStats,
              ]);
              return {
                name: fileName.substring(0, fileName.length - 3),
                content: content.toString(),
                lastUpdated: stats.mtime,
                createdAt: stats.birthtime,
              };
            })
        );
      const files = await Promise.all(filesPromises);
      return {
        name: lane,
        files,
      };
    })
  );
  ctx.body = lanesWithFiles;
}

router.get("/resource/:path*", getResource);

async function createResource(ctx) {
  const subPath = decodeURIComponent(ctx.request.url.substring("/resources".length));
  const isFile = ctx.request.body?.isFile;
  const content = ctx.request.body?.content || "";
  if (isFile) {
    await fs.promises.writeFile(`${TASKS_DIR}/${subPath}`, content);
  } else {
    await fs.promises.mkdir(`${TASKS_DIR}/${subPath}`);
  }
  if (PUID && PGID) {
    await fs.promises.chown(`${TASKS_DIR}/${subPath}`, PUID, PGID);
  }
  ctx.status = 201;
}

router.post("/resource/:path*", createResource);

// Done tasks of a lane live in "<board>/.done/<lane>"
function getDoneLanePath(lanePath) {
  return `${path.posix.dirname(lanePath)}/.done/${path.posix.basename(lanePath)}`;
}

async function createDirectory(dirPath) {
  const firstCreatedDir = await fs.promises.mkdir(`${TASKS_DIR}/${dirPath}`, {
    recursive: true,
  });
  if (!firstCreatedDir || !(PUID && PGID)) {
    return;
  }
  let currentDir = `${TASKS_DIR}/${dirPath}`;
  while (currentDir.length >= firstCreatedDir.length) {
    await fs.promises.chown(currentDir, PUID, PGID);
    currentDir = path.dirname(currentDir);
  }
}

// Card names must be unique within a board, so when a card is moved to another
// board (e.g. into ".done") pick a name not used by any of the board's lanes
async function getAvailableCardPath(cardPath, oldPath) {
  const lanePath = path.posix.dirname(cardPath);
  const boardPath = path.posix.dirname(lanePath);
  const lanes = await fs.promises
    .readdir(`${TASKS_DIR}/${boardPath}`, { withFileTypes: true })
    .catch(() => []);
  const cardNamesPromises = lanes
    .filter((dir) => dir.isDirectory() && !dir.name.startsWith("."))
    .map((dir) =>
      fs.promises.readdir(`${TASKS_DIR}/${boardPath}/${dir.name}`).catch(() => [])
    );
  const usedNames = (await Promise.all(cardNamesPromises)).flat();
  const cardName = path.posix.basename(cardPath, ".md");
  let newCardPath = cardPath;
  let newCardName = `${cardName}.md`;
  let suffix = 2;
  while (usedNames.includes(newCardName) && newCardPath !== oldPath) {
    newCardName = `${cardName} (${suffix}).md`;
    newCardPath = `${lanePath}/${newCardName}`;
    suffix++;
  }
  return newCardPath;
}

async function updateResource(ctx) {
  const oldPath = decodeURIComponent(ctx.request.url.substring("/resources".length));
  let newPath = decodeURIComponent(ctx.request.body.newPath || oldPath).replaceAll(
    /<>:"\/\\\|\?\*#/g,
    " "
  );
  const newContent = ctx.request.body.content;

  // Optional optimistic concurrency check: when the client says which version
  // of the card its content is based on, refuse to overwrite a newer version
  // (e.g. one saved from another tab or device)
  const expectedLastUpdated = ctx.request.body.expectedLastUpdated;
  if (expectedLastUpdated && newContent !== undefined) {
    const currentStats = await fs.promises
      .stat(`${TASKS_DIR}/${oldPath}`)
      .catch(() => null);
    if (
      currentStats?.isFile() &&
      currentStats.mtime.getTime() !== new Date(expectedLastUpdated).getTime()
    ) {
      ctx.status = 409;
      ctx.body = { lastUpdated: currentStats.mtime };
      return;
    }
  }

  if (newPath !== oldPath) {
    const isDirectory = fs.lstatSync(`${TASKS_DIR}/${oldPath}`).isDirectory();
    if (ctx.request.body.keepBoth) {
      newPath = await getAvailableCardPath(newPath, oldPath);
    }
    await createDirectory(path.posix.dirname(newPath));
    await fs.promises.rename(
      `${TASKS_DIR}/${oldPath}`,
      `${TASKS_DIR}/${newPath}`
    );
    const oldDoneLanePath = getDoneLanePath(oldPath);
    const newDoneLanePath = getDoneLanePath(newPath);
    if (
      isDirectory &&
      fs.existsSync(`${TASKS_DIR}/${oldDoneLanePath}`) &&
      !fs.existsSync(`${TASKS_DIR}/${newDoneLanePath}`)
    ) {
      await fs.promises.rename(
        `${TASKS_DIR}/${oldDoneLanePath}`,
        `${TASKS_DIR}/${newDoneLanePath}`
      );
    }
  }

  const isFile = fs.lstatSync(`${TASKS_DIR}/${newPath}`).isFile();
  if (isFile && newContent !== undefined) {
    await fs.promises.writeFile(
      `${TASKS_DIR}/${newPath}`,
      newContent
    );
  }
  if (PUID && PGID) {
    await fs.promises.chown(`${TASKS_DIR}/${newPath}`, PUID, PGID);
  }
  if (isFile) {
    // Return the new version so the client can base its next save on it
    const stats = await fs.promises.stat(`${TASKS_DIR}/${newPath}`);
    ctx.status = 200;
    ctx.body = { lastUpdated: stats.mtime };
    return;
  }
  ctx.status = 204;
}

router.patch("/resource/:path*", updateResource);

async function deleteResource(ctx) {
  const subPath = decodeURIComponent(ctx.request.url.substring("/resources".length));
  await fs.promises.rm(`${TASKS_DIR}/${subPath}`, {
    force: true,
    recursive: true,
  });
  ctx.status = 204;
}

router.delete("/resource/:path*", deleteResource);

async function uploadImage(ctx) {
  await fs.promises.mkdir(`${CONFIG_DIR}/images`, {
    recursive: true,
  });
  const originalname = ctx.request.file.originalname;
  const extension = originalname.split(".").at(-1);
  const imageName = `${uuid.v4()}.${extension}`;
  await fs.promises.writeFile(
    `${CONFIG_DIR}/images/${imageName}`,
    ctx.request.file.buffer
  );
  if (PUID && PGID) {
    await fs.promises.chown(
      `${CONFIG_DIR}/images/${imageName}`,
      PUID,
      PGID
    );
  }
  ctx.status = 200;
  ctx.body = imageName;
}

router.post("/image", multerInstance.single("file"), uploadImage);

async function updateSort(ctx) {
  const subPath = decodeURIComponent(ctx.request.url.substring("/sort".length));
  const boardSort = ctx.request.body || {};
  await updateConfigJson("sort.json", (sort) => ({
    ...sort,
    [subPath]: boardSort,
  }));
  ctx.status = 200;
}

router.put("/sort/:path*", updateSort);

async function getSort(ctx) {
  const subPath = decodeURIComponent(ctx.request.url.substring("/sort".length));
  const sort = await readConfigJson("sort.json");
  ctx.body = sort[subPath] || {};
  ctx.status = 200;
}

router.get("/sort/:path*", getSort);

app.use(cors());
app.use(bodyParser());

const httpInstance = new Koa();
httpInstance.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    err.status = err.statusCode || err.status || 500;
    throw err;
  }
});

app.use(
  mount(`${BASE_PATH}/_api`, httpInstance)
);
app.use(
  mount(`${BASE_PATH}/_api/image`, serve(`${CONFIG_DIR}/images`))
);

app.use(mount(`${BASE_PATH}/_api`, router.routes()));
app.use(mount((`${BASE_PATH || '/'}`), (ctx, next) => {
  let middleware = serve('static')
  if (/stylesheets\/(.*).css$/.test(ctx.request.url)) {
    const fileName = ctx.request.url.split('/stylesheets').at(-1);
    ctx.request.url = fileName;
    middleware = serve(`${CONFIG_DIR}/stylesheets`)
  }
  else if (ctx.request.url.endsWith('apple-touch-icon.png')) {
    ctx.request.url = `/favicon/apple-touch-icon.png`
  }
  else if (/favicon\/favicon-(16|32)x(16|32).png$/.test(ctx.request.url)) {
    const dimension = /favicon\/favicon-(16|32)x(16|32).png$/.exec(ctx.request.url)[1]
    ctx.request.url = `/favicon/favicon-${dimension}x${dimension}.png`
  }
  else if (/assets\/(.*).(js|css)$/.test(ctx.request.url)) {
    const fileName = ctx.request.url.split('/').at(-1);
    ctx.request.url = `/assets/${fileName}`
  }
  // default to index.html
  else {
    ctx.request.url = '/'
  }
  return middleware(ctx, next)
}));

async function getfilesPaths(dirPath) {
  const dirsAndFiles = (await fs.promises.readdir(dirPath,
    { withFileTypes: true }
  ));
  const files = dirsAndFiles
    .filter(dirOrFile => dirOrFile.isFile() 
      && dirOrFile.name.endsWith(".md") 
      && !dirOrFile.name.startsWith(".")
  ).map(file => `${dirPath}/${file.name}`)
  const subFilesPromises = dirsAndFiles
    .filter(dirOrFile => dirOrFile.isDirectory())
    .map(dir => getfilesPaths(`${dirPath}/${dir.name}`))
  const subFiles = await Promise.all(subFilesPromises).then(res => res.flat())
  return [...files, ...subFiles];
}

async function removeUnusedImages() {
  await fs.promises.mkdir(TASKS_DIR, { recursive: true });
  const tasksDir = TASKS_DIR;
  const allFiles = await getfilesPaths(tasksDir)
  const filesReadPromises = allFiles.map(file => fs.promises.readFile(file))
  const filesContents = await Promise.all(filesReadPromises).then(buffers => buffers.map(buffer => buffer.toString()));
  const imagesBeingUsed = filesContents
    .map((content) => content.match(/!\[[^\]]*\]\(([^\s]+[.]*)\)/g))
    .flat()
    .filter((image) => !!image && image.includes("_api/image/"))
    .map((image) => image.split("_api/image/")[1].slice(0, -1));
  const allImages = await fs.promises.readdir(
    `${CONFIG_DIR}/images`
  );
  const unusedImages = allImages.filter(
    (image) => !imagesBeingUsed.includes(image)
  );
  await Promise.all(
    unusedImages.map((image) =>
      fs.promises.rm(`${CONFIG_DIR}/images/${image}`)
    )
  );
}

const localImagesCleanupInterval = /^\d{1,}$/.test(process.env.LOCAL_IMAGES_CLEANUP_INTERVAL)
  ? Number(process.env.LOCAL_IMAGES_CLEANUP_INTERVAL)
  : 1440

if (localImagesCleanupInterval) {
  const intervalInMs = localImagesCleanupInterval * 60000;
  try {
    if (intervalInMs > 0) {
      setInterval(removeUnusedImages, intervalInMs);
    }
  } catch (error) {
    console.error(error);
  }
}

console.log('API starting at ' + PORT)
fs.promises.mkdir(CONFIG_DIR, { recursive: true });
if (PUID && PGID) {
  fs.promises.chown(CONFIG_DIR, PUID, PGID);
}
app.listen(PORT);
