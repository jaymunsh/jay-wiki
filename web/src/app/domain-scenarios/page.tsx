import { redirect } from 'next/navigation';

/** 도메인 리허설은 개별 화면만 있고 인덱스는 시나리오 허브가 담당한다. */
export default function DomainScenariosIndexPage() {
  redirect('/scenarios');
}
