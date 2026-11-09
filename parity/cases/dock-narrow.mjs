// The dock below sm (< 640px): the bar scrolls sideways, so its height is the magnification + 40px and the label's row stays
// inside it. A case of its own, because the viewport width is the case's.
import { refDock, elDock, ITEMS } from './dock.mjs';

export default {
    name: 'dock-narrow',
    // Its own page: the page takes the first case's width, so a shared one would shrink every case packed behind it.
    isolated: true,
    width: 500,
    items: [
        { id: 'bottom', wrap: 'height:160px;', ref: refDock('bottom'), el: elDock('bottom') },
        { id: 'top', wrap: 'height:160px;', ref: refDock('top'), el: elDock('top') },
        { id: 'magnification-80', wrap: 'height:160px;', ref: refDock('bottom', ITEMS, '', 80), el: elDock('bottom', ITEMS, ' magnification="80"') },
    ],
};
