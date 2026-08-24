/**
 * @toast-ui/editor@3.2.2의 package.json "exports" 맵에 "types" 조건이 빠져 있어
 * moduleResolution: "bundler" 하에서 바로 임포트하면 타입을 못 찾는다(TS7016).
 * 실제 타입 정의 파일을 상대 경로로 다시 내보내 그 문제를 우회한다.
 */
declare module "@toast-ui/editor" {
  export * from "../../node_modules/@toast-ui/editor/types/index";
  export { default } from "../../node_modules/@toast-ui/editor/types/index";
}
