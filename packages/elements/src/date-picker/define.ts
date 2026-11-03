import { defineElement } from '@gilav21/elements-base';
import '../calendar/define.js';
import '../popover/define.js';
import { GeDatePicker } from './date-picker.js';
import { GeDateRangePicker } from './sub/date-range-picker.js';

defineElement('date-picker', GeDatePicker);
defineElement('date-range-picker', GeDateRangePicker);
