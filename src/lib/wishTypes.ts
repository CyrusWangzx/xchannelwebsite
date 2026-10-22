/**
 * 许愿池 · 数据模型
 *
 * 现阶段数据层是「只读展示 + 会内内存提交」：
 * 种子数据只读，用户提交只进内存（刷新即散），不落库、不显示联系方式。
 * 将来 B 端页面/接口就绪后，换掉 WishStore 的实现即可（见 lib/wishStore.ts），
 * 组件层通过 useWishData / useWishSubmit 消费，一行都不用改。
 */

/** 物体类型：硬币 = 许愿，漂流瓶 = 建议 */
export type WishKind = "coin" | "bottle";

/** 审核状态。只做展示阶段，种子数据多为 approved / implemented */
export type WishStatus = "pending" | "approved" | "rejected" | "implemented";

/** 官方回复 */
export interface WishReply {
  /** 回复正文 */
  text: string;
  /** 回复方（如「X.Channel 团队」） */
  by: string;
  /** 回复时间（ISO），只作展示 */
  at?: string;
}

export interface Wish {
  id: string;
  kind: WishKind;
  /** 正文，10–200 字。乐观渲染的「幽灵物体」没有正文 */
  text?: string;
  /** 昵称，缺省「匿名」 */
  author: string;
  status: WishStatus;
  /** 共鸣数（点赞） */
  likes: number;
  /** 官方回复，可空 */
  reply?: WishReply;
  /** 创建时间（ISO） */
  createdAt: string;
  /**
   * 「幽灵物体」：提交后本地乐观渲染的那一枚，半透明、无文字、仅提交者可见。
   * 真正的实体要等审核通过（B 端），所以它永远不会出现在 list() 里。
   */
  ghost?: boolean;
}

/** 提交载荷 */
export interface WishDraft {
  kind: WishKind;
  /** 10–200 字 */
  text: string;
  /** 昵称，可空 → 匿名 */
  author?: string;
  /**
   * 联系方式，可空。**仅后台可见**——所以它连内存里都不留（见 wishStore 注释）。
   * 将来接真实接口时，这一项必须在传输层加密。
   */
  contact?: string;
  /** 蜜罐字段：正常用户看不见也填不到，填了就是机器人 */
  trap?: string;
}
