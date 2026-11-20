# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: 用户同意由实现方选择 React + Node.js，用作飞书工作台内打开的 H5 网页应用，适配桌面与手机。

## Users

需要批量收集同事企业邮箱的飞书企业成员。

## Product Purpose

将多行工号或选定人员、部门转换为去重、空格分隔的企业邮箱集合，供复制使用。

## Operating Context

飞书企业自建网页应用。开发阶段提供明确标识的演示模式；生产使用飞书通讯录及原生成员/部门选择器。

## Capabilities and Constraints

- 工号严格匹配 employee_no，邮箱使用 enterprise_email，不以个人邮箱替代。
- 部门选择默认包含所有子部门，成员去重。
- 仅访问应用获准访问的通讯录范围。
- 两个输入入口与统一结果区，一键复制，提示未匹配及缺失邮箱。
- 不存储查询历史；应用凭证仅存后端。
- 用户无额外公司视觉约束。实际凭证、部署域名和管理员授权尚待提供。

## Product Principles

- 不猜测工号或邮箱。
- 明示范围、失败与不完整结果。
- 演示数据和真实数据明确隔离。
- 结果可以直接复制用于工作。

## Evidence on Hand

空项目，无真实通讯录和飞书凭证。演示人员均为虚构。
