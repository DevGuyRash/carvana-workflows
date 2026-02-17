export const VIN_PATTERN = '([A-HJ-NPR-Z0-9]{11,17})\\b';
export const STOCK_PATTERN = '((?:[A-Z0-9&]{2,8}-)?\\d{7,12}(?:-(?:[A-Z]{2,8}|\\d{1,4}))?)\\b';
export const PID_PATTERN = '(\\d{3,})\\b';

export const DESCRIPTOR_REGEX =
  /(?:^|[^A-Z0-9&])((?:[A-Z0-9&]{2,8}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?-([A-HJ-NPR-Z0-9]{11,17})(?:-(\d{3,}))?(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])/i;
export const STOCK_NORMALIZE_REGEX = /^((?:[A-Z0-9&]{2,8}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?$/i;
export const VIN_ONLY_REGEX = /^[A-HJ-NPR-Z0-9]{11,17}$/i;

export const JIRA_CAPTURE_DESCRIPTOR_PATTERN_TEXT =
  '(?:^|[^A-Z0-9&])((?:[A-Z0-9&]{2,8}-)?\\d{7,12})(?:-([A-Z]{2,8}|\\d{1,4}))?-([A-HJ-NPR-Z0-9]{11,17})(?:-(\\d{3,}))?(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])';

export const FORMULA_DESCRIPTOR_PATTERN_TEXT =
  '(?:^|[^A-Z0-9&])(?:[A-Z0-9&]{2,8}-)?\\d{7,12}(?:-(?:[A-Z]{2,8}|\\d{1,4}))?-[A-HJ-NPR-Z0-9]{11,17}(?:-\\d{3,})?(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])';

export const FORMULA_TAG_PATTERN_TEXT =
  '^(?:[A-Z0-9&]{2,8}-)?\\d{7,12}-((?:[A-Z]{2,8}|\\d{1,4}))-[A-HJ-NPR-Z0-9]{11,17}(?:-\\d{3,})?(?:-[A-Z0-9&]{2,30})*$';

export const ATTRIBUTE6_PID_DESCRIPTOR_PATTERN_TEXT =
  '(?:^|[^A-Z0-9&])(?:[A-Z0-9&]{2,8}-)?\\d{7,12}(?:-(?:[A-Z]{2,8}|\\d{1,4}))?-[A-HJ-NPR-Z0-9]{11,17}-(\\d{3,})(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])';
