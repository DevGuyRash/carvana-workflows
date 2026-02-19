Option Explicit

Private Const WATCH_BUFFER_ROWS As Long = 25

Private Sub Worksheet_Change(ByVal Target As Range)
    On Error GoTo SafeExit
    If Not Application.EnableEvents Then Exit Sub

    Dim lo As ListObject
    Set lo = Me.ListObjects("tbl_invoice_lines")

    Dim firstCol As Long, lastCol As Long
    firstCol = lo.Range.Column
    lastCol = firstCol + lo.Range.Columns.Count - 1

    Dim tableTopRow As Long
    tableTopRow = lo.HeaderRowRange.Row

    Dim tableBottomRow As Long
    tableBottomRow = lo.Range.Row + lo.Range.Rows.Count - 1

    Dim watchBottomRow As Long
    watchBottomRow = tableBottomRow + WATCH_BUFFER_ROWS
    If watchBottomRow > Me.Rows.Count Then watchBottomRow = Me.Rows.Count

    'Watch table columns over the active table footprint + a small tail buffer.
    Dim watchRng As Range
    Set watchRng = Me.Range(Me.Cells(tableTopRow, firstCol), Me.Cells(watchBottomRow, lastCol))

    If Intersect(Target, watchRng) Is Nothing Then Exit Sub

    Dim changedBottomRow As Long
    Dim changedTopRow As Long
    Dim changedFirstCol As Long
    Dim changedLastCol As Long

    changedTopRow = Target.Row
    changedBottomRow = Target.Row + Target.Rows.Count - 1
    changedFirstCol = Target.Column
    changedLastCol = Target.Column + Target.Columns.Count - 1

    'Run a single-pass sync with changed-range protection to avoid trimming the edited block.
    Application.Run "'" & ThisWorkbook.Name & "'!AP_SyncAll_WithTarget", _
                    True, changedBottomRow, changedTopRow, changedFirstCol, changedLastCol, True

    Application.OnUndo "Undo last invoice-lines change", "'" & ThisWorkbook.Name & "'!AP_UndoInvoiceLinesChange"

SafeExit:
End Sub