import type { RichTextAddonLocaleTable } from '../../rich-text-addon-kit.js';

/** Localized strings for the actions addon UI. */
export interface RichTextActionsLocale {
    readonly code: string;
    readonly rtl?: boolean;
    readonly dialog: {
        /** `{text}` is the selected text. */
        readonly attachToText: string;
        readonly attachToImage: string;
        readonly editTitle: string;
        readonly searchPlaceholder: string;
        readonly searchLabel: string;
        readonly noActions: string;
        readonly replacesExisting: string;
        readonly cancel: string;
        readonly attach: string;
        readonly replace: string;
        /** Badge shown when the selected action attaches both triggers at once. */
        readonly combinedBadge: string;
    };
    readonly popover: {
        readonly unavailable: string;
        readonly edit: string;
        readonly remove: string;
        readonly add: string;
    };
    readonly form: {
        /** `{field}` is the field label. */
        readonly required: string;
    };
    /** Display names for the DOM triggers, shown in the picker and popover. */
    readonly triggers: {
        readonly click: string;
        readonly hover: string;
    };
}

const en: RichTextActionsLocale = {
    code: 'en',
    dialog: {
        attachToText: 'Attach action to “{text}”',
        attachToImage: 'Attach action to image',
        editTitle: 'Edit action',
        searchPlaceholder: 'Search actions…',
        searchLabel: 'Search actions',
        noActions: 'No actions available.',
        replacesExisting: '(replaces existing)',
        cancel: 'Cancel',
        attach: 'Attach',
        replace: 'Replace',
        combinedBadge: 'Click + hover',
    },
    popover: { unavailable: '(unavailable)', edit: 'Edit', remove: 'Remove', add: '+ Add action' },
    form: { required: '{field} is required' },
    triggers: { click: 'click', hover: 'hover' },
};

const he: RichTextActionsLocale = {
    code: 'he',
    rtl: true,
    dialog: {
        attachToText: 'צירוף פעולה ל־„{text}”',
        attachToImage: 'צירוף פעולה לתמונה',
        editTitle: 'עריכת פעולה',
        searchPlaceholder: 'חיפוש פעולות…',
        searchLabel: 'חיפוש פעולות',
        noActions: 'אין פעולות זמינות.',
        replacesExisting: '(מחליף קיים)',
        cancel: 'ביטול',
        attach: 'צרף',
        replace: 'החלף',
        combinedBadge: 'לחיצה + מעבר עכבר',
    },
    popover: { unavailable: '(לא זמין)', edit: 'עריכה', remove: 'הסרה', add: '+ הוספת פעולה' },
    form: { required: '{field} הוא שדה חובה' },
    triggers: { click: 'לחיצה', hover: 'ריחוף' },
};

const ar: RichTextActionsLocale = {
    code: 'ar',
    rtl: true,
    dialog: {
        attachToText: 'إرفاق إجراء بالنص «{text}»',
        attachToImage: 'إرفاق إجراء بالصورة',
        editTitle: 'تعديل الإجراء',
        searchPlaceholder: 'البحث في الإجراءات…',
        searchLabel: 'البحث في الإجراءات',
        noActions: 'لا توجد إجراءات متاحة.',
        replacesExisting: '(يستبدل الحالي)',
        cancel: 'إلغاء',
        attach: 'إرفاق',
        replace: 'استبدال',
        combinedBadge: 'نقر + تمرير',
    },
    popover: { unavailable: '(غير متاح)', edit: 'تعديل', remove: 'إزالة', add: '+ إضافة إجراء' },
    form: { required: '{field} حقل مطلوب' },
    triggers: { click: 'نقر', hover: 'تمرير' },
};

const de: RichTextActionsLocale = {
    code: 'de',
    dialog: {
        attachToText: 'Aktion an „{text}“ anhängen',
        attachToImage: 'Aktion an Bild anhängen',
        editTitle: 'Aktion bearbeiten',
        searchPlaceholder: 'Aktionen suchen…',
        searchLabel: 'Aktionen suchen',
        noActions: 'Keine Aktionen verfügbar.',
        replacesExisting: '(ersetzt vorhandene)',
        cancel: 'Abbrechen',
        attach: 'Anhängen',
        replace: 'Ersetzen',
        combinedBadge: 'Klick + Hover',
    },
    popover: { unavailable: '(nicht verfügbar)', edit: 'Bearbeiten', remove: 'Entfernen', add: '+ Aktion hinzufügen' },
    form: { required: '{field} ist erforderlich' },
    triggers: { click: 'Klick', hover: 'Hover' },
};

const fr: RichTextActionsLocale = {
    code: 'fr',
    dialog: {
        attachToText: 'Associer une action à « {text} »',
        attachToImage: 'Associer une action à l’image',
        editTitle: 'Modifier l’action',
        searchPlaceholder: 'Rechercher des actions…',
        searchLabel: 'Rechercher des actions',
        noActions: 'Aucune action disponible.',
        replacesExisting: '(remplace l’existante)',
        cancel: 'Annuler',
        attach: 'Associer',
        replace: 'Remplacer',
        combinedBadge: 'Clic + survol',
    },
    popover: { unavailable: '(indisponible)', edit: 'Modifier', remove: 'Supprimer', add: '+ Ajouter une action' },
    form: { required: '{field} est obligatoire' },
    triggers: { click: 'clic', hover: 'survol' },
};

const es: RichTextActionsLocale = {
    code: 'es',
    dialog: {
        attachToText: 'Adjuntar acción a «{text}»',
        attachToImage: 'Adjuntar acción a la imagen',
        editTitle: 'Editar acción',
        searchPlaceholder: 'Buscar acciones…',
        searchLabel: 'Buscar acciones',
        noActions: 'No hay acciones disponibles.',
        replacesExisting: '(reemplaza la existente)',
        cancel: 'Cancelar',
        attach: 'Adjuntar',
        replace: 'Reemplazar',
        combinedBadge: 'Clic + pasar el cursor',
    },
    popover: { unavailable: '(no disponible)', edit: 'Editar', remove: 'Quitar', add: '+ Añadir acción' },
    form: { required: '{field} es obligatorio' },
    triggers: { click: 'clic', hover: 'cursor encima' },
};

const ja: RichTextActionsLocale = {
    code: 'ja',
    dialog: {
        attachToText: '「{text}」にアクションを追加',
        attachToImage: '画像にアクションを追加',
        editTitle: 'アクションを編集',
        searchPlaceholder: 'アクションを検索…',
        searchLabel: 'アクションを検索',
        noActions: '利用できるアクションがありません。',
        replacesExisting: '（既存のものを置き換え）',
        cancel: 'キャンセル',
        attach: '追加',
        replace: '置き換え',
        combinedBadge: 'クリック + ホバー',
    },
    popover: { unavailable: '（利用不可）', edit: '編集', remove: '削除', add: '+ アクションを追加' },
    form: { required: '{field}は必須です' },
    triggers: { click: 'クリック', hover: 'ホバー' },
};

const zh: RichTextActionsLocale = {
    code: 'zh',
    dialog: {
        attachToText: '为“{text}”添加操作',
        attachToImage: '为图片添加操作',
        editTitle: '编辑操作',
        searchPlaceholder: '搜索操作…',
        searchLabel: '搜索操作',
        noActions: '没有可用的操作。',
        replacesExisting: '（将替换现有操作）',
        cancel: '取消',
        attach: '添加',
        replace: '替换',
        combinedBadge: '点击 + 悬停',
    },
    popover: { unavailable: '（不可用）', edit: '编辑', remove: '移除', add: '+ 添加操作' },
    form: { required: '{field}为必填项' },
    triggers: { click: '点击', hover: '悬停' },
};

const ru: RichTextActionsLocale = {
    code: 'ru',
    dialog: {
        attachToText: 'Привязать действие к «{text}»',
        attachToImage: 'Привязать действие к изображению',
        editTitle: 'Изменить действие',
        searchPlaceholder: 'Поиск действий…',
        searchLabel: 'Поиск действий',
        noActions: 'Нет доступных действий.',
        replacesExisting: '(заменит существующее)',
        cancel: 'Отмена',
        attach: 'Привязать',
        replace: 'Заменить',
        combinedBadge: 'Клик + наведение',
    },
    popover: { unavailable: '(недоступно)', edit: 'Изменить', remove: 'Удалить', add: '+ Добавить действие' },
    form: { required: 'Поле «{field}» обязательно' },
    triggers: { click: 'клик', hover: 'наведение' },
};

const pt: RichTextActionsLocale = {
    code: 'pt',
    dialog: {
        attachToText: 'Anexar ação a “{text}”',
        attachToImage: 'Anexar ação à imagem',
        editTitle: 'Editar ação',
        searchPlaceholder: 'Pesquisar ações…',
        searchLabel: 'Pesquisar ações',
        noActions: 'Nenhuma ação disponível.',
        replacesExisting: '(substitui a existente)',
        cancel: 'Cancelar',
        attach: 'Anexar',
        replace: 'Substituir',
        combinedBadge: 'Clique + passar o mouse',
    },
    popover: { unavailable: '(indisponível)', edit: 'Editar', remove: 'Remover', add: '+ Adicionar ação' },
    form: { required: '{field} é obrigatório' },
    triggers: { click: 'clique', hover: 'passar o mouse' },
};

/** Built-in locales of the actions addon, keyed by the editor's locale id. */
export const RICH_TEXT_ACTIONS_LOCALES: RichTextAddonLocaleTable<RichTextActionsLocale> = {
    en, he, ar, de, fr, es, ja, zh, ru, pt,
};
