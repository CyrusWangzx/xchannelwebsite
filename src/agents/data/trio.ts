/**
 * 三巨头共用名片
 *
 * 三页的联动区都用这一份，各自把「自己」放大高亮。
 * Slogan 取三份 PRD 里 6.2「统一口径」那张表——三份文档互相有出入
 * （豆总那份写「从 0 到 1，把方向变成结果」，二表哥那份写「业务行不行，二表哥说了算」），
 * 这里统一成一套对仗的短句，长标语只留在各自的 hero 上。
 */
import type { TrioMember } from "../types";

export const trio: TrioMember[] = [
  {
    slug: "douzong",
    name: "豆总",
    role: "综合拍板官",
    slogan: "事干不干，豆总来拍板",
    href: "#/member/douzong",
  },
  {
    slug: "erbiaoge",
    name: "二表哥",
    role: "业务诊断官",
    slogan: "业务行不行，二表哥说了算",
    href: "#/member/erbiaoge",
  },
  {
    slug: "jinchan",
    name: "小金子",
    role: "财务决策官",
    slogan: "钱值不值，小金子来谋",
    href: "#/member/jinchan",
  },
];
