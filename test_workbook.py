import unittest
from io import BytesIO

from openpyxl import Workbook, load_workbook

from workbook import HEADERS, export_contacts, import_contacts


class WorkbookTests(unittest.TestCase):
    def test_round_trip_preserves_text_and_multiple_values(self):
        contact = {"name": "=1+1", "favorite": True, "methods": {
            "电话": ["001234", "+86 123"], "邮箱": ["a@example.com"],
            "社交账号": ["@sample"], "地址": ["虚构地址"]}}
        data = export_contacts([contact])
        with BytesIO(data) as stream:
            book = load_workbook(stream)
            self.assertEqual(book.active["A2"].data_type, "s")
            self.assertEqual(book.active["C2"].value, "001234\n+86 123")
            self.assertEqual(book.active.max_row, 2)
            book.close()
        self.assertEqual(import_contacts(data), [contact])

    def test_invalid_row_reports_location(self):
        book = Workbook()
        book.active.append(HEADERS)
        book.active.append(["样例", "是"])
        book.active.append(["不合法的收藏值", "偶尔"])
        stream = BytesIO()
        book.save(stream)
        with self.assertRaisesRegex(ValueError, "第 3 行"):
            import_contacts(stream.getvalue())

    def test_duplicate_header_reports_problem(self):
        book = Workbook()
        book.active.append((*HEADERS[:-1], HEADERS[2]))
        stream = BytesIO()
        book.save(stream)
        with self.assertRaisesRegex(ValueError, "表头包含重复"):
            import_contacts(stream.getvalue())

    def test_extra_nonempty_data_column_reports_row(self):
        book = Workbook()
        book.active.append(HEADERS)
        book.active.append(["首行联系人", "否"])
        book.active.append(["额外列联系人", "是", None, None, None, None, "第七列"])
        stream = BytesIO()
        book.save(stream)
        with self.assertRaisesRegex(ValueError, "第 3 行.*额外的非空列"):
            import_contacts(stream.getvalue())

    def test_short_row_and_blank_extra_column_are_valid(self):
        book = Workbook()
        book.active.append(HEADERS)
        book.active.append(["只有姓名"])
        book.active["G2"].number_format = "@"
        stream = BytesIO()
        book.save(stream)
        rows = import_contacts(stream.getvalue())
        self.assertEqual(rows, [{"name": "只有姓名", "favorite": False,
                                 "methods": {kind: [] for kind in HEADERS[2:]}}])

    def test_empty_export_is_template(self):
        self.assertEqual(import_contacts(export_contacts([])), [])


if __name__ == "__main__":
    unittest.main()
