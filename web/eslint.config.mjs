import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    // benchmark/는 별도 프로젝트에서 생성해 public에 복사한 정적 배포물이다.
    // 앱 소스 규칙으로 다시 검사하면 onclick 전역 함수 같은 의도한 구조까지 경고가 된다.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/benchmark/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // 시연 화면 7곳이 effect 안에서 상태를 세팅한다. 동작에는 문제가 없고
      // 각 화면의 상태 흐름을 다시 설계해야 고칠 수 있어 경고로 두고 백로그에 남긴다.
      'react-hooks/set-state-in-effect': 'warn',
      // 기술 로고는 MinIO 자산 route 에서 오고 로드 실패 시 텍스트로 폴백한다.
      // next/image 최적화 대상이 아니다.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
