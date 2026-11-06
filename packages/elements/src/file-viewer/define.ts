import { defineElement } from '@gilav21/elements-base';
import '../spinner/define.js';
import { GeFileViewer } from './file-viewer.js';
import { GeFileViewerContent, GeFileViewerToolbar } from './sub/file-viewer-parts.js';

defineElement('file-viewer', GeFileViewer);
defineElement('file-viewer-toolbar', GeFileViewerToolbar);
defineElement('file-viewer-content', GeFileViewerContent);
