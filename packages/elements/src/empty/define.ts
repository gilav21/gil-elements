import { defineElement } from '@gilav21/elements-base';
import { GeEmpty } from './empty.js';
import { GeEmptyContent } from './sub/empty-content.js';
import { GeEmptyDescription } from './sub/empty-description.js';
import { GeEmptyHeader } from './sub/empty-header.js';
import { GeEmptyMedia } from './sub/empty-media.js';
import { GeEmptyTitle } from './sub/empty-title.js';

defineElement('empty', GeEmpty);
defineElement('empty-header', GeEmptyHeader);
defineElement('empty-media', GeEmptyMedia);
defineElement('empty-title', GeEmptyTitle);
defineElement('empty-description', GeEmptyDescription);
defineElement('empty-content', GeEmptyContent);
