/**
 * 분기 사슬을 닫아 컴파일러가 경우의 수를 세게 한다.
 *
 * 맨 끝이 그냥 `else`인 `?:` 사슬은 유니온에 새 멤버가 늘어도 말없이 받아들이고 마지막
 * 분기로 흘려보낸다. 여기서 닫으면 모든 경우를 이름 붙였을 때만 `value`가 `never`로
 * 좁혀지므로, 하나가 늘면 빌드가 멈춘다.
 *
 * throw는 타입이 닿지 않는 경계 — JSON에서 파싱되었거나 API가 건넨 값 — 몫이다.
 * 유니온을 로컬에서 계산하는 곳에서는 그냥 죽은 코드이고, 컴파일 에러가 이 함수의 전부다.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`)
}
