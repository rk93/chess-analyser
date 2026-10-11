export const REVIEW_DEPTH_PRESETS=Object.freeze({
  ultra:{base:4,critical:6,label:'Ultra Fast (preview only)'},
  fast:{base:8,critical:12,label:'Fast (recommended)'},
  balanced:{base:12,critical:16,label:'Balanced'},
  deep:{base:16,critical:20,label:'Deep'}
});
export const REVIEW_DEPTH_SETTING='chess-review-depth';
export function getReviewDepthPreset(storage=globalThis.localStorage){
  let key='fast';
  try{key=storage?.getItem(REVIEW_DEPTH_SETTING)||'fast'}catch{}
  return {...REVIEW_DEPTH_PRESETS[key]||REVIEW_DEPTH_PRESETS.fast,key:REVIEW_DEPTH_PRESETS[key]?key:'fast'};
}
export function reviewDepthIsCurrent(data,preset){
  return data?.reviewDepthKey===preset.key&&Number(data?.reviewBaseDepth)===preset.base&&Number(data?.reviewCriticalDepth)===preset.critical;
}
