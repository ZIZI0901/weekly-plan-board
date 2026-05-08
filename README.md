# Weekly Plan Board

一个纯前端的本地周计划/日计划看板，支持周待办、日待办、完成项、月视图、拖拽排序和颜色标记。数据保存在浏览器 `localStorage` 中，不需要后端服务。

## 使用

直接用浏览器打开 `index.html` 即可。

## 项目结构

```text
.
├── index.html
├── src
│   ├── app.js
│   └── styles.css
├── .editorconfig
├── .gitignore
└── README.md
```

## 说明

- `index.html`：页面结构和资源引用
- `src/styles.css`：页面样式
- `src/app.js`：计划表交互逻辑和本地数据存储
