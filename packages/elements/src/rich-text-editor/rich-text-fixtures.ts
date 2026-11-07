/** Emptiness cases shared by the validator tests and the element tests, so the two emptiness rules cannot drift. */
export const EMPTINESS_FIXTURES: ReadonlyArray<readonly [string, boolean]> = [
    ['', true],
    ['<p><br></p>', true],
    ['<br>', true],
    ['<p>&nbsp;</p>', true],
    ['<p>​</p>', true],
    ['<ul data-task-list><li data-task><input type="checkbox"><span>&nbsp;</span></li></ul>', true],
    ['  \n', true],
    ['​', true],
    ['<p>a</p>', false],
    ['<p><img src="x.png"></p>', false],
    ['<hr>', false],
    ['<table><tr><td></td><td></td></tr></table>', false],
];
