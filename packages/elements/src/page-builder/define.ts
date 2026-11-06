import { defineElement } from '@gilav21/elements-base';
import '../bento-grid/define.js';
import '../icon/define.js';
import '../select/define.js';
import '../switch/define.js';
import { GePageBuilder } from './page-builder.js';
import { GePropertyEditor } from './sub/property-editor.js';

defineElement('page-builder', GePageBuilder);
defineElement('property-editor', GePropertyEditor);
