// test.ts
import { Princessify } from './src/logic/princessify';

// 実際のTLデータ（コメントや古いお団子入り）
const inputTL = `
@party ヴルム ルイズ ユイ クローチェ アングレ

1:13 ヴルム [OOOOX]
1:05 ルイズ [XOOXX]
1:04 ユイ ユイが左向いたら
1:00 ヴルム [XOOOX]
0:52 クローチェ オートオン
0:47 ヴルム
0:43 ユイ オートオフ
`;

const tool = new Princessify();
console.log(tool.convert(inputTL));