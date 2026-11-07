import { defineElement } from '@gilav21/elements-base';
import '../button/define.js';
import { GeErrorPage } from './error-page.js';
import { GeErrorPageActions } from './sub/error-page-actions.js';
import { GeErrorPageIllustration } from './sub/error-page-illustration.js';

defineElement('error-page', GeErrorPage);
defineElement('error-page-illustration', GeErrorPageIllustration);
defineElement('error-page-actions', GeErrorPageActions);
export { GeErrorPage, GeErrorPageActions, GeErrorPageIllustration };
