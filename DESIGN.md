---
name: 飞书邮箱助手
description: 清晰、克制的企业通讯录查询工具
colors:
  navy: "#153e63"
  primary: "#245fc7"
  primary-hover: "#174da9"
  page: "#f2f5f8"
  surface: "#ffffff"
  text: "#1f3447"
  muted: "#607185"
  line: "#dce4ec"
  tint: "#edf3fb"
  success: "#22664e"
  warning: "#845119"
  error: "#ab3434"
  placeholder: "#586d83"
  summary-text: "#5a6c80"
  summary-background: "#edf4f3"
  output-background: "#f7f9fc"
  focus: "#4d7dc6"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
    fontSize: "clamp(24px, 2.2vw, 30px)"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "-0.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.5
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif"
    fontSize: "14px"
    lineHeight: 1.7
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif"
    fontSize: "12px"
    lineHeight: 1.8
  data:
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace"
    fontSize: "14px"
    lineHeight: 1.9
rounded:
  chip: "5px"
  control: "6px"
  input: "7px"
  notice: "8px"
  surface: "12px"
spacing:
  compact: "8px"
  control: "16px"
  section: "24px"
  wide: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.input}"
    padding: "14px 16px"
  tabs:
    textColor: "{colors.primary}"
  chip:
    rounded: "{rounded.chip}"
    padding: "5px 6px 5px 10px"
  workspace:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
  result-summary:
    backgroundColor: "{colors.summary-background}"
    textColor: "{colors.summary-text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: 飞书邮箱助手

## Overview

**Creative North Star: "通讯录索引"**

面向办公场景的轻量工具界面：深蓝页头建立应用识别，浅底与白色工作区承载输入和结果。视觉表达服从标准表单、标签切换、清单和明确反馈，不以装饰取代任务信息。

**Key Characteristics:**
- 浅底、深蓝页头与蓝色主操作。
- 紧凑清单、清晰分隔与单一结果出口。
- 中文系统字体负责阅读，等宽字体仅用于工号和邮箱数据。
- 成功、待确认和错误同时使用颜色与文字表达。

## Colors

深蓝用于页头；主蓝用于操作、选中标签和链接。白色工作面与蓝灰页面底色分离任务层级，不增加常驻阴影。成功绿、警告棕和错误红只用于对应状态。

占位文字和格式示例使用 placeholder；结果汇总使用独立 summary-text，避免在浅绿色背景上直接沿用普通次级文本色。焦点轮廓使用 focus，不以背景色变化代替键盘位置指示。

本轮四项修复已复核：占位字与格式示例对白对比度 5.343:1，占位字对输出框底色 5.066:1；汇总字对汇总底色 4.840:1；焦点轮廓对白 4.147:1、对页面底色 3.790:1。

## Typography

主界面采用系统中文无衬线栈，保留平台阅读习惯。标题以大小和字重形成层级，不使用装饰性副标题。工号、邮箱与数据示例使用等宽栈；数字采用 tabular-nums。

主标题在手机为 24px，桌面上限 30px；分区标题 17px；操作与常规正文 13–14px；次级说明 11–12px。说明文字具有较宽松行距，长邮箱可断行，不能撑开工作区。

## Layout

内容容器最大宽度 1240px。桌面工作区两列比例为 1:1.1，左侧负责两种输入入口，右侧集中呈现可复制结果与异常明细。工作区内部使用分隔线，不嵌套装饰卡片。

1000px 以下收紧间距和次级信息；740px 以下改为单列，输入在先、结果在后，主容器横向内边距 16px。页头在手机收起辅助品牌文案。使用须知由三列变为单列。

## Elevation & Depth

主工作面依靠边框、底色和分隔线建立层级，不使用阴影。只有演示选择器使用浮层阴影 `0 16px 56px #102c4933` 与遮罩 `#122e4b66`，明确区分受保护的选择任务。

## Shapes

工作区和选择器使用 12px 圆角；输入框 7px；常规按钮和汇总条 6px；通知 8px；成员标签 5px。圆形仅用于头像或空态图标承载，不扩散为所有控件的造型。

## Components

- **按钮**：主操作蓝底白字，常规最小高 39px，提交操作最小高 44px；禁用降低透明度并显示不可操作光标。复制成功切换为绿色，并伴随文字反馈。
- **输入框**：白底细描边，垂直可调整；焦点有独立轮廓，占位文字维持正文级对比度。输出框以轻微底色区分只读数据。
- **标签导航**：标准按钮语义，选中以蓝色文字与底部细线同时指示；支持左右方向键、Home 和 End。
- **成员标签**：紧凑灰蓝底，部门标签略偏蓝；移除按钮有独立可访问名称。
- **结果汇总**：按输入项、匹配人数、邮箱数量顺序陈述实际计数，不做装饰性指标面板。
- **提示与明细**：警告、错误和成功配合图标及文字，不仅依赖颜色。查询变更清除旧结果，复制失败保留手工复制路径。
- **焦点与动效**：全局焦点轮廓 3px，偏移 3px；选择器搜索焦点偏移 2px。按钮颜色过渡 140ms ease-out；加载图标旋转 1s linear。尊重 reduced-motion，关闭动画和过渡。

## Do's and Don'ts

### Do:
- Do 保持浅底深蓝办公方向和标准表单操作习惯。
- Do 用清晰文字区分演示、授权、查询、异常和复制状态。
- Do 将工号、邮箱数据与普通说明文字分开排版。
- Do 在更改颜色后检查真实相邻背景上的文本和焦点对比度。

### Don't:
- Don't 以个人邮箱或虚构结果掩盖企业邮箱缺失。
- Don't 将数据状态仅编码为颜色。
- Don't 为普通工作区叠加装饰性阴影或嵌套卡片。
- Don't 让长邮箱或移动端说明文字撑出容器。

本记录提取自 [当前样式](<src/styles.css>) 和 [界面实现](<src/main.jsx>)，并核对最新 [桌面截图](<.impeccable/review/desktop.png>)、[手机截图](<.impeccable/review/mobile.png>)。本次 verdict 为四项对比度修复 **resolved / ship**；不扩大为真实飞书客户端联调结论。
