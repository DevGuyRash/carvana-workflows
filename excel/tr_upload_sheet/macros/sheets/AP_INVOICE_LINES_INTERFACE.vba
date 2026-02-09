Option Explicit

Private Sub Worksheet_Change(ByVal Target As Range)
    On Error GoTo SafeExit
    If Not Application.EnableEvents Then Exit Sub

    Dim lo As ListObject
    Set lo = Me.ListObjects("tbl_invoice_lines")

    Dim watchRng As Range
    Dim firstCol As Long, lastCol As Long, headerRow As Long
    firstCol = lo.Range.Column
    lastCol = firstCol + lo.Range.Columns.Count - 1
    headerRow = lo.HeaderRowRange.Row

    'Watch full table columns from header down so row-delete shifts are caught.
    Set watchRng = Me.Range(Me.Cells(headerRow, firstCol), Me.Cells(Me.Rows.Count, lastCol))

    If Intersect(Target, watchRng) Is Nothing Then Exit Sub

    'Run the sync (Application.Run avoids "Sub or function not defined" compile issues)
    Application.Run "'" & ThisWorkbook.Name & "'!AP_SyncInvoiceLinesTable", True
    Application.Run "'" & ThisWorkbook.Name & "'!AP_SyncInvoicesTable", True
    Application.OnUndo "Undo last invoice-lines change", "'" & ThisWorkbook.Name & "'!AP_UndoInvoiceLinesChange"

SafeExit:
End Sub
