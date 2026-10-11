export const AUTO_PLAY_SPEED_KEY='chess-review-autoplay-ms';
export const AUTO_PLAY_SPEEDS=Object.freeze([300,500,1000,2000,3000]);
export const DEFAULT_AUTO_PLAY_MS=300;
export function getAutoPlayMs(storage=globalThis.localStorage){
  try{const ms=Number(storage?.getItem(AUTO_PLAY_SPEED_KEY));return AUTO_PLAY_SPEEDS.includes(ms)?ms:DEFAULT_AUTO_PLAY_MS}catch{return DEFAULT_AUTO_PLAY_MS}
}
