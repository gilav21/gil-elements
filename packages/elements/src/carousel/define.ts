import { defineElement } from '@gilav21/elements-base';
import { GeCarousel } from './carousel.js';
import { GeCarouselContent } from './sub/carousel-content.js';
import { GeCarouselItem } from './sub/carousel-item.js';
import { GeCarouselNext } from './sub/carousel-next.js';
import { GeCarouselPrevious } from './sub/carousel-previous.js';

defineElement('carousel', GeCarousel);
defineElement('carousel-content', GeCarouselContent);
defineElement('carousel-item', GeCarouselItem);
defineElement('carousel-previous', GeCarouselPrevious);
defineElement('carousel-next', GeCarouselNext);
