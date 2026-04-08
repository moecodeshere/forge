import "@testing-library/jest-dom";

Element.prototype.scrollIntoView = function scrollIntoView() {
  /* jsdom stub — ExecutionLogPanel and similar call this on mount */
};
