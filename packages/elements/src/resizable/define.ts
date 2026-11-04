import { defineElement } from '@gilav21/elements-base';
import { GeResizablePanelGroup } from './resizable.js';
import { GeResizableHandle } from './sub/resizable-handle.js';
import { GeResizablePanel } from './sub/resizable-panel.js';

defineElement('resizable-panel-group', GeResizablePanelGroup);
defineElement('resizable-panel', GeResizablePanel);
defineElement('resizable-handle', GeResizableHandle);
