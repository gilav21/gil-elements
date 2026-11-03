import { defineElement } from '@gilav21/elements-base';
import { GeField } from './field.js';
import { GeFieldDescription } from './sub/field-description.js';
import { GeFieldError } from './sub/field-error.js';
import { GeFieldGroup } from './sub/field-group.js';
import { GeFieldLabel } from './sub/field-label.js';
import { GeFieldLegend } from './sub/field-legend.js';
import { GeFieldSeparator } from './sub/field-separator.js';
import { GeFieldSet } from './sub/field-set.js';

defineElement('field', GeField);
defineElement('field-label', GeFieldLabel);
defineElement('field-description', GeFieldDescription);
defineElement('field-error', GeFieldError);
defineElement('field-group', GeFieldGroup);
defineElement('field-set', GeFieldSet);
defineElement('field-legend', GeFieldLegend);
defineElement('field-separator', GeFieldSeparator);
