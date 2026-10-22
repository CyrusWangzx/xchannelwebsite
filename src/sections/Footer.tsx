/**
 * 页脚
 *
 * Cyrus（2026-10-21）：把页脚原有的「特别鸣谢 + 11 位成员头像」整块**移除**，
 * 只留组织 logo —— 成员形象与鸣谢之后会以**彩蛋**的形式重新设计，
 * 不适合再摊在每页最下方这种人人都会看到的位置。
 *
 * 所以这里现在只剩一件事：一条 hairline 收束页面 + 居中 logo。
 * logo 尺寸沿用原来的「放大」档（h-12 / md:h-16），换成居中是刻意的：
 * 没有第二栏时左对齐会读成「右边还没做完」，居中才像收尾的落款。
 *
 * 成员数据本身**没删**——`content.ts` 的 `members` 仍被 X.形象 页与个人主页使用。
 */
import Container from "../components/Container";
import Logo from "../components/Logo";

export default function Footer() {
  return (
    <footer className="border-t border-hairline">
      <Container className="flex justify-center py-14 md:py-16">
        <Logo loading="lazy" className="h-12 md:h-16" />
      </Container>
    </footer>
  );
}
