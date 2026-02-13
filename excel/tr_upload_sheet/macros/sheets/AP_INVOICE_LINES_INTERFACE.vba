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

    Dim changedBottomRow As Long
    Dim changedTopRow As Long
    Dim changedFirstCol As Long
    Dim changedLastCol As Long
    Dim isClearAction As Boolean
    changedTopRow = Target.Row
    changedBottomRow = Target.Row + Target.Rows.Count - 1
    changedFirstCol = Target.Column
    changedLastCol = Target.Column + Target.Columns.Count - 1
    isClearAction = RangeIsAllBlank(Target)

    'Run the sync (Application.Run avoids "Sub or function not defined" compile issues)
    Application.Run "'" & ThisWorkbook.Name & "'!AP_SyncInvoiceLinesTable_WithTarget", _
                    True, changedBottomRow, changedTopRow, changedFirstCol, changedLastCol, Not isClearAction
    Application.Run "'" & ThisWorkbook.Name & "'!AP_SyncInvoicesTable", True, True
    Application.OnUndo "Undo last invoice-lines change", "'" & ThisWorkbook.Name & "'!AP_UndoInvoiceLinesChange"

SafeExit:
End Sub

Private Function RangeIsAllBlank(ByVal rng As Range) As Boolean
    Dim area As Range
    Dim cell As Range
    Dim valueInCell As Variant

    For Each area In rng.Areas
        For Each cell In area.Cells
            valueInCell = cell.Value2
            If IsError(valueInCell) Then
                Exit Function
            End If
            If Not IsEmpty(valueInCell) Then
                If Len(Trim$(CStr(valueInCell))) > 0 Then
                    Exit Function
                End If
            End If
        Next cell
    Next area

    RangeIsAllBlank = True
End Function
