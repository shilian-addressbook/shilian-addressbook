"""Excel format for the address book."""
from io import BytesIO
from zipfile import ZipFile

from openpyxl import Workbook, load_workbook
from openpyxl.utils import get_column_letter

METHODS = ("电话", "邮箱", "社交账号", "地址")
HEADERS = ("姓名", "收藏", *METHODS)
MAX_FILE = 5 * 1024 * 1024
MAX_ROWS = 5000


def clean_contact(data):
    name, favorite, methods = data["name"], data["favorite"], data["methods"]
    if (not isinstance(name, str) or not name.strip() or len(name) > 100 or
            any(ord(c) < 32 for c in name)):
        raise ValueError("姓名必须为 1–100 个字符。")
    if not isinstance(favorite, bool) or not isinstance(methods, dict):
        raise ValueError("联系人格式不正确。")
    result = {}
    for kind in METHODS:
        values = methods.get(kind, [])
        if not isinstance(values, list) or len(values) > 25 or any(
            not isinstance(v, str) or not v.strip() or len(v) > 500 or
            any(ord(c) < 32 for c in v) for v in values
        ):
            raise ValueError(f"{kind}每类最多 25 条，每条限 500 个字符，不能换行。")
        result[kind] = [v.strip() for v in values]
    return {"name": name.strip(), "favorite": favorite, "methods": result}


def export_contacts(contacts):
    if not isinstance(contacts, list) or len(contacts) > MAX_ROWS:
        raise ValueError("每份工作簿最多包含 5000 位联系人。")
    book = Workbook()
    sheet = book.active
    sheet.title = "通讯录"
    sheet.append(HEADERS)
    for raw in contacts:
        contact = clean_contact(raw)
        row = [contact["name"], "是" if contact["favorite"] else "否"]
        row.extend("\n".join(contact["methods"][kind]) for kind in METHODS)
        sheet.append(row)
        for cell in sheet[sheet.max_row]:
            cell.data_type = "s"
            cell.number_format = "@"
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for index, width in enumerate((22, 12, 24, 32, 24, 40), 1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    output = BytesIO()
    book.save(output)
    return output.getvalue()


def import_contacts(data):
    with ZipFile(BytesIO(data)) as package:
        if sum(item.file_size for item in package.infolist()) > 30 * 1024 * 1024:
            raise ValueError("工作簿解压后过大。")
    book = load_workbook(BytesIO(data), read_only=True, keep_links=False)
    try:
        sheet = book.worksheets[0]
        sheet.reset_dimensions()
        rows = sheet.iter_rows(min_col=1)
        columns = len(HEADERS)
        header_values = [cell.value for cell in next(rows, ())]
        if any(value not in (None, "") for value in header_values[columns:]):
            raise ValueError("表头有额外的列，请使用导出的模板。")
        headers = tuple(header_values[:columns])
        nonempty_headers = [value for value in headers if value not in (None, "")]
        if len(set(nonempty_headers)) != len(nonempty_headers):
            raise ValueError("表头包含重复的列名，请使用导出的模板。")
        if headers != HEADERS:
            raise ValueError("表头不匹配，请使用导出的模板。")
        contacts = []
        for number, cells in enumerate(rows, 2):
            values = [cell.value for cell in cells]
            if number > MAX_ROWS + 1:
                raise ValueError("请将数据放在前 5000 个数据行内。")
            if all(value in (None, "") for value in values):
                continue
            try:
                if any(value not in (None, "") for value in values[columns:]):
                    raise ValueError("包含额外的非空列，请只在模板列内填写。")
                if any(cell.data_type == "f" for cell in cells):
                    raise ValueError("不接受公式，请粘贴为文本。")
                fields = (values + [None] * columns)[:columns]
                name, favorite, *details = fields
                if favorite not in (None, "", "是", "否"):
                    raise ValueError("收藏栏只接受「是」、「否」或空白。")
                methods = {
                    kind: [line.strip() for line in str(value).splitlines() if line.strip()]
                    if value is not None else []
                    for kind, value in zip(METHODS, details)
                }
                contacts.append(clean_contact(
                    {"name": name, "favorite": favorite == "是", "methods": methods}
                ))
            except ValueError as error:
                raise ValueError(f"第 {number} 行：{error}") from error
        return contacts
    finally:
        book.close()
