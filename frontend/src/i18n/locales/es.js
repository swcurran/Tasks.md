export default {
	common: {
		confirm: "Confirmar", cancel: "Cancelar", card: "Tarjeta", lane: "Columna", noTagsFound: "No se encontraron etiquetas", close: "Cerrar",
	},
	header: {
		searchPlaceholder: "Buscar", filterByTag: "Filtrar por etiqueta", filterNone: "Sin filtro",
		sortBy: "Ordenar por",
		sort: { manually: "Manual", nameAsc: "Nombre (A-Z)", nameDesc: "Nombre (Z-A)", tagsAsc: "Etiquetas (A-Z)", tagsDesc: "Etiquetas (Z-A)", dueAsc: "Fecha más próxima", dueDesc: "Fecha más lejana", lastUpdated: "Última actualización", createdFirst: "Creado primero" },
		viewMode: "Modo de vista",
		view: { extended: "Extendido", regular: "Regular", compact: "Compacto", tight: "Ajustado" },
		newLane: "Nueva columna", selectCards: "Seleccionar tarjetas", exitSelection: "Salir de selección", locale: "Idioma",
		showDone: "Tareas completadas", showActive: "Tareas activas",
		urgent: "Urgentes ({{count}})", urgentTitle: "Mostrar solo tareas urgentes", moreOptions: "Más opciones",
	},
	card: { due: "Vencimiento {{date}}", done: "Completada {{date}}" },
	cardName: { urgent: "Marcar como urgente", notUrgent: "Marcar como no urgente", done: "Marcar como completada", undone: "Marcar como no completada", rename: "Renombrar", delete: "Eliminar", showOptions: "Mostrar opciones" },
	laneName: { rename: "Renombrar", deleteCard: "Eliminar tarjeta", deleteLane: "Eliminar columna", createCard: "Crear tarjeta", showOptions: "Mostrar opciones" },
	expandedCard: {
		addTag: "Agregar etiqueta", changeColor: "Cambiar color", deleteTag: "Eliminar etiqueta", dueDate: "Fecha de vencimiento",
		minimize: "Minimizar", expand: "Expandir", colorOption: "Color {{n}}", rename: "Clic para renombrar",
		tagError: { duplicate: "Etiqueta duplicada" },
		done: "Marcar como completada", undone: "Marcar como no completada",
		urgent: "Marcar como urgente", notUrgent: "No urgente",
		close: "Cerrar"
	},
	bulk: {
		selected: "{{count}} tarjeta seleccionada", selected_plural: "{{count}} tarjetas seleccionadas",
		addTags: "Agregar etiquetas", removeTags: "Eliminar etiquetas", setDueDate: "Asignar fecha de vencimiento", urgent: "Marcar como urgentes", notUrgent: "Marcar como no urgentes", done: "Marcar como completadas", undone: "Marcar como no completadas", delete: "Eliminar", clearSelection: "Limpiar selección",
		tagSearchPlaceholder: "Buscar etiquetas", removeTagPlaceholder: "Eliminar etiqueta", createTag: 'Crear "{{tag}}"',
		deleteConfirm: "¿Eliminar seleccionadas?", deleteConfirm_plural: "¿Eliminar seleccionadas?",
	},
	doneView: { title: "Completadas" },
	validation: {
		mustHaveName: "El nombre es obligatorio", hiddenByDot: "Oculto por punto", duplicateName: "Nombre duplicado",
		forbiddenChars: "Caracteres prohibidos", noMdExtension: "Sin extensión .md", prohibitedName: "Nombre prohibido",
	},
	keyboard: { title: "Atajos de teclado", sections: { navigation: "Navegación", cardActions: "Acciones de tarjeta", general: "General" }, shortcuts: {} },
}
