/**
 * 운영 실측값을 하나의 눈금 위에 놓는다.
 * 축 상한은 가장 오래 걸린 실측값(16분 42초) 바로 위인 20분이다. 더 멀리 잡으면 오른쪽이 비고,
 * 가장 긴 막대가 축 끝에 닿지 않아 무엇이 제일 오래 걸렸는지가 흐려진다.
 * 2.2초와 16분 42초가 같은 축에 들어가야 해서 선형 축으로는 앞쪽 다섯 개가 전부 왼쪽 끝에 뭉친다.
 * 그래서 로그 눈금을 쓰고, 축은 자릿수만 비교한다고 화면에 적는다.
 */
export const TIME_SCALE_MIN = 1;
export const TIME_SCALE_MAX = 1200;
export const TIME_SCALE_TICKS = [
  { seconds: 1, label: '1초' },
  { seconds: 10, label: '10초' },
  { seconds: 60, label: '1분' },
  { seconds: 600, label: '10분' },
  { seconds: 1200, label: '20분' },
] as const;

/** 초 단위 측정값을 0~100 사이의 위치로 바꾼다. 범위 밖 값은 양 끝으로 자른다. */
export function logPosition(seconds: number, min = TIME_SCALE_MIN, max = TIME_SCALE_MAX): number {
  const clamped = Math.min(Math.max(seconds, min), max);
  return (Math.log10(clamped / min) / Math.log10(max / min)) * 100;
}
