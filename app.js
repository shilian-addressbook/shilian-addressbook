"use strict";

const kinds = ["电话", "邮箱", "社交账号", "地址"];
const key = "shilian.contacts.v1";
const languageKey = "shilian.language";
const englishKinds = { 电话: "Phone", 邮箱: "Email", 社交账号: "Social account", 地址: "Address" };
const englishLabels = {
  "brand-name": "Shilian",
  "page-heading": "My address book",
  tagline: "Keep the people who matter easy to find.",
  "search-label": "Search",
  import: "Import Excel",
  export: "Export Excel",
  add: "＋ New contact",
  all: "All",
  favorites: "★ Favorites",
  "storage-hint": "Contacts are stored in this browser. Export Excel to back them up or download a blank template.",
  "name-label": "Name",
  "methods-hint": "You can add multiple entries of the same type.",
  "add-method": "＋ Add contact method",
  cancel: "Cancel",
  "save-contact": "Save contact",
};
const $ = (id) => document.getElementById(id);
const chineseLabels = Object.fromEntries(Object.keys(englishLabels).map((id) => [id, $(id).textContent]));
let language = "zh";
let lastStatus = ["", ""];
let contacts = [];
let favoritesOnly = false;
let editing = null;
let nextMethodHint = 0;

const t = (chinese, english) => language === "en" ? english : chinese;

function applyLanguage() {
  document.documentElement.lang = t("zh-CN", "en");
  document.title = t("拾联 · 通讯录", "Shilian · Address Book");
  for (const id of Object.keys(englishLabels)) {
    $(id).textContent = t(chineseLabels[id], englishLabels[id]);
  }
  $("language").textContent = t("English", "中文");
  $("language").lang = t("en", "zh-CN");
  $("contacts-panel").setAttribute("aria-label", t("联系人", "Contacts"));
  $("search").placeholder = t("姓名、电话、邮箱…", "Name, phone, email…");
  $("status").textContent = t(...lastStatus);
  render();
}

function make(tag, text, attrs = {}) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  return element;
}

function button(text, action, attrs) {
  const element = make("button", text, { type: "button", ...attrs });
  element.addEventListener("click", action);
  return element;
}

function status(chinese, english) {
  lastStatus = [chinese, english];
  $("status").textContent = t(...lastStatus);
}

function save(next) {
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    status("无法保存。请检查浏览器存储空间和权限。", "Could not save. Check browser storage space and permissions.");
    return false;
  }
  contacts = next;
  render();
  return true;
}

function render() {
  const query = $("search").value.trim().toLocaleLowerCase();
  const shown = contacts.filter((contact) => (!favoritesOnly || contact.favorite) &&
    [contact.name, ...Object.values(contact.methods).flat()]
      .some((value) => value.toLocaleLowerCase().includes(query)));
  $("all").setAttribute("aria-pressed", String(!favoritesOnly));
  $("favorites").setAttribute("aria-pressed", String(favoritesOnly));
  $("count").textContent = t(`${shown.length} / ${contacts.length} 位联系人`,
    `${shown.length} of ${contacts.length} contacts`);
  $("list").replaceChildren(...shown.map(card));
  $("empty").hidden = shown.length > 0;
  $("empty").textContent = query ? t("没有匹配的联系人。", "No matching contacts.") :
    favoritesOnly ? t("还没有收藏。点击联系人卡片上的星标可收藏。", "No favorites yet. Select a star to add a contact.") :
      t("还没有联系人。新建一位联系人，或从 Excel 批量导入。", "No contacts yet. Add a contact or import an Excel file.");
}

function card(contact) {
  const label = contact.favorite ? "取消收藏" : "收藏";
  const englishLabel = contact.favorite ? "Remove favorite" : "Add favorite";
  const star = button(contact.favorite ? "★" : "☆", () => {
    if (save(contacts.map((item) => item.id === contact.id ?
      { ...item, favorite: !item.favorite } : item))) {
      status(`${label}：${contact.name}`, contact.favorite ?
        `Removed ${contact.name} from favorites.` : `Added ${contact.name} to favorites.`);
      [...$("list").querySelectorAll(".star")].find((node) =>
        node.dataset.id === contact.id)?.focus();
      if (favoritesOnly && contact.favorite) $("favorites").focus();
    }
  }, { class: "star", "aria-label": `${t(label, englishLabel)} ${contact.name}`,
    "aria-pressed": String(contact.favorite), "data-id": contact.id });
  const article = make("article", "", { class: "card" });
  const title = make("div", "", { class: "card-top" });
  title.append(make("h2", contact.name), star);
  article.append(title);
  const details = make("ul");
  for (const kind of kinds) {
    for (const value of contact.methods[kind] ?? []) {
      details.append(make("li", t(`${kind}：${value}`, `${englishKinds[kind]}: ${value}`)));
    }
  }
  article.append(details.children.length ? details :
    make("p", t("暂无联系方式", "No contact details"), { class: "hint" }));
  const actions = make("div", "", { class: "actions" });
  actions.append(button(t("编辑", "Edit"), () => openEditor(contact)), button(t("删除", "Delete"), () => {
    if (confirm(t(`删除「${contact.name}」？`, `Delete “${contact.name}”?`)) &&
      save(contacts.filter((item) => item.id !== contact.id))) status("已删除联系人。", "Contact deleted.");
  }, { class: "danger" }));
  article.append(actions);
  return article;
}

function addMethod(kind = kinds[0], value = "", focus = false) {
  const row = make("div", "", { class: "method" });
  const select = make("select", "", { "aria-label": t("联系方式类型", "Contact method type") });
  for (const item of kinds) select.append(make("option", t(item, englishKinds[item]), { value: item }));
  select.value = kind;
  const input = make("input", "", { "aria-label": t("联系方式内容", "Contact detail"),
    maxlength: "500", placeholder: t("填写内容", "Enter a value") });
  input.value = value;
  const hint = make("span", t("请填写这条联系方式，或移除该行。",
    "Enter a value for this contact method or remove the row."), { class: "hint danger" });
  hint.hidden = true;
  if (focus) {
    hint.id = "method-hint-" + ++nextMethodHint;
    hint.style.gridColumn = "1 / -1";
    input.dataset.addedMethod = "";
    input.setAttribute("aria-describedby", hint.id);
    input.addEventListener("input", () => {
      if (input.value.trim()) {
        hint.hidden = true;
        input.removeAttribute("aria-invalid");
      }
    });
  }
  row.append(select, input, button(t("移除", "Remove"), () => {
    row.remove();
    $("add-method").focus();
  }, { "aria-label": t("移除此条联系方式", "Remove this contact method") }));
  if (focus) row.append(hint);
  $("methods").append(row);
  if (focus) select.focus();
}

function openEditor(contact = null) {
  editing = contact;
  $("editor-title").textContent = contact ? t("编辑联系人", "Edit contact") : t("新建联系人", "New contact");
  $("name").value = contact?.name ?? "";
  $("methods").replaceChildren();
  $("form-error").textContent = "";
  for (const kind of kinds) {
    for (const value of contact?.methods[kind] ?? []) addMethod(kind, value);
  }
  if (!$("methods").children.length) addMethod();
  $("editor").showModal();
}

$("contact-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const missing = [...$("methods").querySelectorAll("input[data-added-method]")]
    .filter((input) => !input.value.trim());
  for (const input of missing) {
    input.setAttribute("aria-invalid", "true");
    $(input.getAttribute("aria-describedby")).hidden = false;
  }
  if (missing.length) {
    missing[0].focus();
    return;
  }

  const name = $("name").value.trim();
  const methods = Object.fromEntries(kinds.map((kind) => [kind, []]));
  for (const row of $("methods").children) {
    const value = row.querySelector("input").value.trim();
    if (value) methods[row.querySelector("select").value].push(value);
  }
  if (!name || [...name].some((char) => char.charCodeAt(0) < 32) ||
    Object.values(methods).some((values) =>
    values.length > 25 || values.some((value) => [...value].some((char) => char.charCodeAt(0) < 32)))) {
    $("form-error").textContent = t("请填写姓名。每类联系方式最多 25 条，内容不能包含制表符等控制字符。",
      "Enter a name. Each contact method supports up to 25 entries. Tabs and other control characters are not allowed.");
    return;
  }
  if (!editing && contacts.length >= 5000) {
    $("form-error").textContent = t("通讯录最多保存 5000 位联系人。", "You can save up to 5,000 contacts.");
    return;
  }
  const contact = { id: editing?.id ?? crypto.randomUUID(), name, favorite: editing?.favorite ?? false, methods };
  const next = editing ? contacts.map((item) => item.id === editing.id ? contact : item) : [...contacts, contact];
  if (!save(next)) {
    $("form-error").textContent = t("浏览器无法保存，请检查存储空间和权限。",
      "Could not save. Check browser storage space and permissions.");
    return;
  }
  $("editor").close();
  status(`已保存：${name}`, `Saved ${name}.`);
});

async function exchange(action, body, type) {
  const response = await fetch(`/api/${action}`, { method: "POST", headers: { "Content-Type": type }, body });
  if (!response.ok) throw new Error((await response.json()).error);
  return response;
}

$("file").addEventListener("change", async () => {
  const [file] = $("file").files;
  $("file").value = "";
  if (!file) return;
  $("import").disabled = true;
  try {
    const response = await exchange("import", file, "application/octet-stream");
    const imported = await response.json();
    if (contacts.length + imported.length > 5000) {
      status("导入失败：合计超过 5000 位联系人，未写入任何记录。",
        "Import failed. This would exceed 5,000 contacts. No contacts were added.");
    } else if (!imported.length) {
      status("表格没有需要导入的联系人。", "No contacts found in the workbook.");
    } else if (save([...contacts, ...imported.map((item) => ({ ...item, id: crypto.randomUUID() }))])) {
      favoritesOnly = false;
      $("search").value = "";
      render();
      status(`已导入 ${imported.length} 位联系人。`, `Imported ${imported.length} contact(s).`);
    }
  } catch (error) {
    status(`导入失败：${error.message}`, "Import failed. Check that the .xlsx file follows the exported template.");
  } finally {
    $("import").disabled = false;
  }
});

$("export").addEventListener("click", async () => {
  $("export").disabled = true;
  try {
    const response = await exchange("export", JSON.stringify(contacts), "application/json");
    const url = URL.createObjectURL(await response.blob());
    make("a", "", { href: url, download: t("拾联通讯录.xlsx", "Shilian Address Book.xlsx") }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(`已导出 ${contacts.length} 位联系人。`, `Exported ${contacts.length} contact(s).`);
  } catch (error) {
    status(`导出失败：${error.message}`, "Export failed. Check your connection and try again.");
  } finally {
    $("export").disabled = false;
  }
});

$("import").addEventListener("click", () => $("file").click());
$("add").addEventListener("click", () => openEditor());
$("add-method").addEventListener("click", () => addMethod(kinds[0], "", true));
$("cancel").addEventListener("click", () => $("editor").close());
$("search").addEventListener("input", render);
$("all").addEventListener("click", () => { favoritesOnly = false; render(); });
$("favorites").addEventListener("click", () => { favoritesOnly = true; render(); });
$("language").addEventListener("click", () => {
  language = t("en", "zh");
  try { localStorage.setItem(languageKey, language); } catch { /* Keep the current session choice. */ }
  applyLanguage();
});
try {
  if (localStorage.getItem(languageKey) === "en") language = "en";
  contacts = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (!Array.isArray(contacts)) throw new Error();
} catch {
  contacts = [];
  status("无法读取浏览器内的历史通讯录。", "Could not load contacts from browser storage.");
}
applyLanguage();
