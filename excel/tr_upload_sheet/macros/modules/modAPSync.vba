Option Explicit

'==== CONFIG ===========================================================
Private Const SH_INVOICES As String = "AP_INVOICES_INTERFACE"
Private Const SH_LINES    As String = "AP_INVOICE_LINES_INTERFACE"

Private Const TBL_INVOICES As String = "tbl_invoices"
Private Const TBL_LINES    As String = "tbl_invoice_lines"

Private Const LINES_BUFFER_ROWS As Long = 0
Private Const COL_LINE_KEY As String = "zzLineKey"
Private Const COL_INVOICE_KEY As String = "zzInvoiceKey"
'======================================================================

'Resize tbl_invoices safely and remap user-entered invoice header values by stable invoice key.
Public Sub AP_SyncInvoicesTable(Optional ByVal Silent As Boolean = True, _
                                Optional ByVal SkipLineSync As Boolean = False, _
                                Optional ByVal ManageAppState As Boolean = True)

    Dim prevEvents As Boolean, prevScreen As Boolean
    Dim prevCalc As XlCalculation

    prevEvents = Application.EnableEvents
    prevScreen = Application.ScreenUpdating
    prevCalc = Application.Calculation

    On Error GoTo EH

    If ManageAppState Then
        Application.EnableEvents = False
        Application.ScreenUpdating = False
        Application.Calculation = xlCalculationManual
    End If

    Dim wb As Workbook: Set wb = ThisWorkbook
    Dim wsInv As Worksheet: Set wsInv = wb.Worksheets(SH_INVOICES)
    Dim wsLines As Worksheet: Set wsLines = wb.Worksheets(SH_LINES)

    Dim loInv As ListObject: Set loInv = wsInv.ListObjects(TBL_INVOICES)
    Dim loLines As ListObject: Set loLines = wsLines.ListObjects(TBL_LINES)

    If Not SkipLineSync Then
        SyncInvoiceLinesCore Silent, 0, 0, 0, 0, False, False
    End If

    EnsureInternalColumn loLines, COL_LINE_KEY
    EnsureInternalColumn loInv, COL_INVOICE_KEY

    Dim usedLineRows As Long
    usedLineRows = LastUsedNonInternalConstantRowCount(loLines)

    Dim invoiceKeys As Collection
    Set invoiceKeys = InvoiceKeysFromLines(loLines, usedLineRows)

    Dim oldRows As Long
    oldRows = loInv.ListRows.Count

    Dim firstDataRow As Long
    firstDataRow = loInv.HeaderRowRange.Row + 1

    Dim firstCol As Long, colCount As Long
    firstCol = loInv.Range.Column
    colCount = loInv.Range.Columns.Count

    Dim lcInvoiceKey As ListColumn
    Set lcInvoiceKey = GetListColumn(loInv, COL_INVOICE_KEY)

    Dim userInputColumns As Collection
    Set userInputColumns = GetUserInputColumns(loInv, True)

    SeedInvoiceKeysByPosition loInv, lcInvoiceKey, invoiceKeys

    If InvoiceKeysMatchTable(lcInvoiceKey, invoiceKeys) Then GoTo CleanExit

    Dim oldValuesByKey As Object
    Set oldValuesByKey = SnapshotUserInputsByInvoiceKey(loInv, lcInvoiceKey, userInputColumns)

    Dim desiredRows As Long
    desiredRows = invoiceKeys.Count
    If desiredRows < 1 Then desiredRows = 1

    If oldRows <> desiredRows Then
        ResizeListObjectDataRows loInv, desiredRows
    End If

    ApplyInvoiceKeyRemap loInv, lcInvoiceKey, userInputColumns, invoiceKeys, oldValuesByKey

    If desiredRows < oldRows Then
        ClearOrphanedTableArea wsInv, _
                               firstDataRow + desiredRows, _
                               firstDataRow + oldRows - 1, _
                               firstCol, colCount, False
    End If

    ApplyTableBottomBoundary loInv

CleanExit:
    If ManageAppState Then
        Application.Calculation = prevCalc
        Application.ScreenUpdating = prevScreen
        Application.EnableEvents = prevEvents
    End If
    Exit Sub

EH:
    If Not Silent Then
        MsgBox "AP_SyncInvoicesTable failed: " & Err.Description, vbExclamation
    End If
    Resume CleanExit
End Sub
'Resize tbl_invoice_lines safely after edits/pastes.
Public Sub AP_SyncInvoiceLinesTable(Optional ByVal Silent As Boolean = True)
    SyncInvoiceLinesCore Silent, 0, 0, 0, 0, False, True
End Sub

'Paste-aware entry-point: uses changed range bounds as a temporary floor.
Public Sub AP_SyncInvoiceLinesTable_WithTarget(Optional ByVal Silent As Boolean = True, _
                                               Optional ByVal changedBottomRow As Long = 0, _
                                               Optional ByVal changedTopRow As Long = 0, _
                                               Optional ByVal changedFirstCol As Long = 0, _
                                               Optional ByVal changedLastCol As Long = 0, _
                                               Optional ByVal protectChangedRows As Boolean = True)
    SyncInvoiceLinesCore Silent, changedBottomRow, changedTopRow, changedFirstCol, changedLastCol, protectChangedRows, True
End Sub

'Single-pass sync wrapper for worksheet events: disables app state once, then runs lines + invoices sync.
Public Sub AP_SyncAll_WithTarget(Optional ByVal Silent As Boolean = True, _
                                 Optional ByVal changedBottomRow As Long = 0, _
                                 Optional ByVal changedTopRow As Long = 0, _
                                 Optional ByVal changedFirstCol As Long = 0, _
                                 Optional ByVal changedLastCol As Long = 0, _
                                 Optional ByVal protectChangedRows As Boolean = True)

    Dim prevEvents As Boolean, prevScreen As Boolean
    Dim prevCalc As XlCalculation

    prevEvents = Application.EnableEvents
    prevScreen = Application.ScreenUpdating
    prevCalc = Application.Calculation

    On Error GoTo EH

    Application.EnableEvents = False
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    SyncInvoiceLinesCore Silent, changedBottomRow, changedTopRow, changedFirstCol, changedLastCol, protectChangedRows, False
    AP_SyncInvoicesTable Silent, True, False

CleanExit:
    Application.Calculation = prevCalc
    Application.ScreenUpdating = prevScreen
    Application.EnableEvents = prevEvents
    Exit Sub

EH:
    If Not Silent Then
        MsgBox "AP_SyncAll_WithTarget failed: " & Err.Description, vbExclamation
    End If
    Resume CleanExit
End Sub

Private Sub SyncInvoiceLinesCore(ByVal Silent As Boolean, _
                                 ByVal changedBottomRow As Long, _
                                 ByVal changedTopRow As Long, _
                                 ByVal changedFirstCol As Long, _
                                 ByVal changedLastCol As Long, _
                                 ByVal protectChangedRows As Boolean, _
                                 ByVal ManageAppState As Boolean)

    Dim prevEvents As Boolean, prevScreen As Boolean
    Dim prevCalc As XlCalculation

    prevEvents = Application.EnableEvents
    prevScreen = Application.ScreenUpdating
    prevCalc = Application.Calculation

    On Error GoTo EH

    If ManageAppState Then
        Application.EnableEvents = False
        Application.ScreenUpdating = False
        Application.Calculation = xlCalculationManual
    End If

    Dim wb As Workbook: Set wb = ThisWorkbook
    Dim wsLines As Worksheet: Set wsLines = wb.Worksheets(SH_LINES)
    Dim loLines As ListObject: Set loLines = wsLines.ListObjects(TBL_LINES)

    EnsureInternalColumn loLines, COL_LINE_KEY

    Dim initialRows As Long
    initialRows = loLines.ListRows.Count

    Dim firstDataRow As Long
    firstDataRow = loLines.HeaderRowRange.Row + 1

    Dim firstCol As Long, colCount As Long
    firstCol = loLines.Range.Column
    colCount = loLines.Range.Columns.Count

    Dim targetFloorRows As Long
    targetFloorRows = 0
    If protectChangedRows And changedBottomRow >= firstDataRow Then
        targetFloorRows = changedBottomRow - firstDataRow + 1
    End If

    BackfillLineNumberDefaults_ForChangedRows loLines, changedTopRow, changedBottomRow

    Dim desiredRows As Long
    desiredRows = LastUsedNonInternalConstantRowCount(loLines) + LINES_BUFFER_ROWS
    desiredRows = MaxLong(desiredRows, targetFloorRows)
    If desiredRows < 1 Then desiredRows = 1

    If loLines.ListRows.Count <> desiredRows Then
        ResizeListObjectDataRows loLines, desiredRows
    End If

    Dim finalRows As Long
    finalRows = loLines.ListRows.Count

    If finalRows < initialRows Then
        ClearOrphanedTableArea wsLines, _
                               firstDataRow + finalRows, _
                               firstDataRow + initialRows - 1, _
                               firstCol, colCount, False
    End If

    ApplyTableBottomBoundary loLines

CleanExit:
    If ManageAppState Then
        Application.Calculation = prevCalc
        Application.ScreenUpdating = prevScreen
        Application.EnableEvents = prevEvents
    End If
    Exit Sub

EH:
    If Not Silent Then
        MsgBox "AP_SyncInvoiceLinesTable failed: " & Err.Description, vbExclamation
    End If
    Resume CleanExit
End Sub
'Custom undo entry-point for AP_INVOICE_LINES_INTERFACE Worksheet_Change.
'Replays Excel's last user action, then re-syncs dependent tables.
Public Sub AP_UndoInvoiceLinesChange()
    Dim prevEvents As Boolean
    prevEvents = Application.EnableEvents

    On Error GoTo CleanExit
    Application.EnableEvents = False

    Application.Undo
    AP_SyncInvoiceLinesTable True
    AP_SyncInvoicesTable True, True

CleanExit:
    Application.EnableEvents = prevEvents
End Sub

'One-time cleanup helper (run manually if you already have #VALUE! leftovers below the table)
Public Sub AP_CleanupInvoicesOrphans(Optional ByVal Silent As Boolean = True)
    Dim prevEvents As Boolean, prevScreen As Boolean, prevCalc As XlCalculation
    prevEvents = Application.EnableEvents
    prevScreen = Application.ScreenUpdating
    prevCalc = Application.Calculation

    On Error GoTo EH
    Application.EnableEvents = False
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wsInv As Worksheet: Set wsInv = ThisWorkbook.Worksheets(SH_INVOICES)
    Dim loInv As ListObject: Set loInv = wsInv.ListObjects(TBL_INVOICES)

    Dim firstCol As Long, colCount As Long
    firstCol = loInv.Range.Column
    colCount = loInv.Range.Columns.Count

    Dim bottomRow As Long
    bottomRow = loInv.Range.Row + loInv.Range.Rows.Count - 1

    'Search below the table within its columns for ANY formulas/values (including leftover structured refs)
    Dim searchRng As Range
    Set searchRng = wsInv.Range(wsInv.Cells(bottomRow + 1, firstCol), _
                                wsInv.Cells(wsInv.Rows.Count, firstCol + colCount - 1))

    Dim lastCell As Range
    Set lastCell = searchRng.Find(What:="*", _
                                  After:=searchRng.Cells(1, 1), _
                                  LookIn:=xlFormulas, _
                                  LookAt:=xlPart, _
                                  SearchOrder:=xlByRows, _
                                  SearchDirection:=xlPrevious, _
                                  MatchCase:=False, _
                                  SearchFormat:=False)

    If Not lastCell Is Nothing Then
        ClearOrphanedTableArea wsInv, bottomRow + 1, lastCell.Row, firstCol, colCount
    End If

CleanExit:
    Application.Calculation = prevCalc
    Application.ScreenUpdating = prevScreen
    Application.EnableEvents = prevEvents
    Exit Sub

EH:
    If Not Silent Then
        MsgBox "AP_CleanupInvoicesOrphans failed: " & Err.Description, vbExclamation
    End If
    Resume CleanExit
End Sub

'===== internal helpers =================================================

Private Sub BackfillLineNumberDefaults_ForChangedRows(ByVal loLines As ListObject, _
                                                      ByVal changedTopRow As Long, _
                                                      ByVal changedBottomRow As Long)

    If loLines.DataBodyRange Is Nothing Then Exit Sub

    Dim lcLineNumber As ListColumn
    Set lcLineNumber = GetListColumn(loLines, "Line Number", "*Line Number")
    If lcLineNumber Is Nothing Then Exit Sub

    Dim userInputColumns As Collection
    Set userInputColumns = GetUserInputColumns(loLines, True)
    If userInputColumns.Count = 0 Then Exit Sub

    Dim firstDataRow As Long
    firstDataRow = loLines.DataBodyRange.Row

    Dim startIx As Long, endIx As Long
    If changedTopRow <= 0 Or changedBottomRow <= 0 Then
        startIx = 1
        endIx = loLines.ListRows.Count
    Else
        startIx = changedTopRow - firstDataRow + 1
        endIx = changedBottomRow - firstDataRow + 1
        If startIx < 1 Then startIx = 1
        endIx = MinLong(endIx, loLines.ListRows.Count)
        If endIx < startIx Then Exit Sub
    End If

    Dim rowIndex As Long
    Dim lineNumberCell As Range

    For rowIndex = startIx To endIx
        Set lineNumberCell = lcLineNumber.DataBodyRange.Cells(rowIndex, 1)

        If IsBlankLike(lineNumberCell.Value2) Then
            If RowHasAnyInputExcludingColumn(userInputColumns, rowIndex, lcLineNumber.Index) Then
                lineNumberCell.Value2 = 1
            End If
        End If
    Next rowIndex
End Sub

Private Function InvoiceKeysFromLines(ByVal loLines As ListObject, Optional ByVal maxRows As Long = 0) As Collection
    Dim keys As New Collection
    Set InvoiceKeysFromLines = keys

    If loLines.DataBodyRange Is Nothing Then Exit Function

    Dim lcLineNumber As ListColumn
    Set lcLineNumber = GetListColumn(loLines, "Line Number", "*Line Number")
    If lcLineNumber Is Nothing Then Exit Function

    Dim lcLineKey As ListColumn
    Set lcLineKey = GetListColumn(loLines, COL_LINE_KEY)
    If lcLineKey Is Nothing Then Exit Function

    Dim seen As Object
    Set seen = CreateObject("Scripting.Dictionary")

    Dim limit As Long
    limit = loLines.ListRows.Count
    If maxRows > 0 Then limit = MinLong(limit, maxRows)

    Dim rowIndex As Long
    For rowIndex = 1 To limit
        Dim lineNumberValue As Variant
        lineNumberValue = lcLineNumber.DataBodyRange.Cells(rowIndex, 1).Value2

        If IsLineStartValue(lineNumberValue) Then
            Dim lineKey As String
            lineKey = Trim$(CStr(lcLineKey.DataBodyRange.Cells(rowIndex, 1).Value2))

            If Len(lineKey) = 0 Then
                lineKey = NewStableKey()
                lcLineKey.DataBodyRange.Cells(rowIndex, 1).Value2 = lineKey
            End If

            If seen.Exists(lineKey) Then
                lineKey = NewStableKey()
                lcLineKey.DataBodyRange.Cells(rowIndex, 1).Value2 = lineKey
            End If

            seen(lineKey) = True
            keys.Add lineKey
        End If
    Next rowIndex
End Function

Private Sub SeedInvoiceKeysByPosition(ByVal loInv As ListObject, _
                                      ByVal lcInvoiceKey As ListColumn, _
                                      ByVal invoiceKeys As Collection)

    If loInv.DataBodyRange Is Nothing Then Exit Sub
    If lcInvoiceKey Is Nothing Then Exit Sub

    Dim maxSeed As Long
    maxSeed = MinLong(loInv.ListRows.Count, invoiceKeys.Count)

    Dim rowIndex As Long
    For rowIndex = 1 To maxSeed
        If IsBlankLike(lcInvoiceKey.DataBodyRange.Cells(rowIndex, 1).Value2) Then
            lcInvoiceKey.DataBodyRange.Cells(rowIndex, 1).Value2 = CStr(invoiceKeys(rowIndex))
        End If
    Next rowIndex
End Sub

Private Function InvoiceKeysMatchTable(ByVal lcInvoiceKey As ListColumn, ByVal invoiceKeys As Collection) As Boolean
    If lcInvoiceKey Is Nothing Then Exit Function
    If lcInvoiceKey.DataBodyRange Is Nothing Then Exit Function

    Dim desiredRows As Long
    desiredRows = invoiceKeys.Count
    If desiredRows < 1 Then desiredRows = 1

    If lcInvoiceKey.DataBodyRange.Rows.Count <> desiredRows Then Exit Function

    If invoiceKeys.Count = 0 Then
        InvoiceKeysMatchTable = (Len(Trim$(CStr(lcInvoiceKey.DataBodyRange.Cells(1, 1).Value2))) = 0)
        Exit Function
    End If

    Dim i As Long
    For i = 1 To invoiceKeys.Count
        If CStr(lcInvoiceKey.DataBodyRange.Cells(i, 1).Value2) <> CStr(invoiceKeys(i)) Then Exit Function
    Next i

    InvoiceKeysMatchTable = True
End Function

Private Function SnapshotUserInputsByInvoiceKey(ByVal loInv As ListObject, _
                                                ByVal lcInvoiceKey As ListColumn, _
                                                ByVal userInputColumns As Collection) As Object

    Dim snapshot As Object
    Set snapshot = CreateObject("Scripting.Dictionary")

    If loInv.DataBodyRange Is Nothing Then
        Set SnapshotUserInputsByInvoiceKey = snapshot
        Exit Function
    End If

    If lcInvoiceKey Is Nothing Then
        Set SnapshotUserInputsByInvoiceKey = snapshot
        Exit Function
    End If

    Dim rowIndex As Long
    For rowIndex = 1 To loInv.ListRows.Count
        Dim keyValue As String
        keyValue = Trim$(CStr(lcInvoiceKey.DataBodyRange.Cells(rowIndex, 1).Value2))

        If Len(keyValue) > 0 Then
            If userInputColumns.Count = 0 Then
                snapshot(keyValue) = Empty
            Else
                Dim rowValues() As Variant
                ReDim rowValues(1 To userInputColumns.Count) As Variant

                Dim colIndex As Long
                For colIndex = 1 To userInputColumns.Count
                    Dim lcUser As ListColumn
                    Set lcUser = userInputColumns(colIndex)
                    rowValues(colIndex) = lcUser.DataBodyRange.Cells(rowIndex, 1).Value2
                Next colIndex

                snapshot(keyValue) = rowValues
            End If
        End If
    Next rowIndex

    Set SnapshotUserInputsByInvoiceKey = snapshot
End Function

Private Sub ApplyInvoiceKeyRemap(ByVal loInv As ListObject, _
                                 ByVal lcInvoiceKey As ListColumn, _
                                 ByVal userInputColumns As Collection, _
                                 ByVal invoiceKeys As Collection, _
                                 ByVal oldValuesByKey As Object)

    If loInv.DataBodyRange Is Nothing Then Exit Sub
    If lcInvoiceKey Is Nothing Then Exit Sub

    If invoiceKeys.Count = 0 Then
        lcInvoiceKey.DataBodyRange.Cells(1, 1).ClearContents
        Exit Sub
    End If
    Dim rowIndex As Long
    For rowIndex = 1 To loInv.ListRows.Count
        Dim keyValue As String
        If rowIndex <= invoiceKeys.Count Then
            keyValue = CStr(invoiceKeys(rowIndex))
        Else
            keyValue = ""
        End If

        lcInvoiceKey.DataBodyRange.Cells(rowIndex, 1).Value2 = keyValue

        If userInputColumns.Count > 0 Then
            If Len(keyValue) > 0 And oldValuesByKey.Exists(keyValue) Then
                Dim rowValues As Variant
                rowValues = oldValuesByKey(keyValue)

                Dim colIndex As Long
                For colIndex = 1 To userInputColumns.Count
                    Dim lcUser As ListColumn
                    Set lcUser = userInputColumns(colIndex)
                    lcUser.DataBodyRange.Cells(rowIndex, 1).Value2 = rowValues(colIndex)
                Next colIndex
            Else
                ClearUserInputRow loInv, userInputColumns, rowIndex
            End If
        End If
    Next rowIndex
End Sub

Private Sub ClearUserInputRow(ByVal lo As ListObject, ByVal userInputColumns As Collection, ByVal rowIndex As Long)
    Dim colIndex As Long
    For colIndex = 1 To userInputColumns.Count
        Dim lcUser As ListColumn
        Set lcUser = userInputColumns(colIndex)
        lcUser.DataBodyRange.Cells(rowIndex, 1).ClearContents
    Next colIndex
End Sub

Private Function LastNonInternalColumnIndex(ByVal lo As ListObject) As Long
    Dim c As Long
    For c = lo.ListColumns.Count To 1 Step -1
        If Not IsInternalHeader(CStr(lo.ListColumns(c).Name)) Then
            LastNonInternalColumnIndex = c
            Exit Function
        End If
    Next c
End Function

Private Function LastUsedNonInternalConstantRowCount(ByVal lo As ListObject) As Long
    If lo.DataBodyRange Is Nothing Then Exit Function

    Dim lastCol As Long
    lastCol = LastNonInternalColumnIndex(lo)
    If lastCol < 1 Then Exit Function

    Dim rng As Range
    Set rng = lo.DataBodyRange.Resize(, lastCol)

    Dim rngConst As Range
    On Error Resume Next
    Set rngConst = rng.SpecialCells(xlCellTypeConstants)
    On Error GoTo 0
    If rngConst Is Nothing Then Exit Function

    Dim lastCell As Range
    Set lastCell = rngConst.Find(What:="*", LookIn:=xlValues, SearchOrder:=xlByRows, SearchDirection:=xlPrevious)
    If lastCell Is Nothing Then Exit Function

    LastUsedNonInternalConstantRowCount = lastCell.Row - lo.DataBodyRange.Row + 1
End Function

Private Function RowHasAnyInput(ByVal inputColumns As Collection, ByVal rowIndex As Long) As Boolean
    Dim colIndex As Long
    For colIndex = 1 To inputColumns.Count
        Dim lc As ListColumn
        Set lc = inputColumns(colIndex)

        If Not IsBlankLike(lc.DataBodyRange.Cells(rowIndex, 1).Value2) Then
            RowHasAnyInput = True
            Exit Function
        End If
    Next colIndex
End Function

Private Function RowHasAnyInputExcludingColumn(ByVal inputColumns As Collection, _
                                               ByVal rowIndex As Long, _
                                               ByVal excludeColumnIndex As Long) As Boolean

    Dim colIndex As Long
    For colIndex = 1 To inputColumns.Count
        Dim lc As ListColumn
        Set lc = inputColumns(colIndex)

        If lc.Index <> excludeColumnIndex Then
            If Not IsBlankLike(lc.DataBodyRange.Cells(rowIndex, 1).Value2) Then
                RowHasAnyInputExcludingColumn = True
                Exit Function
            End If
        End If
    Next colIndex
End Function

Private Function GetUserInputColumns(ByVal lo As ListObject, _
                                     Optional ByVal skipInternalColumns As Boolean = True) As Collection

    Dim userInputColumns As New Collection
    Dim lc As ListColumn

    For Each lc In lo.ListColumns
        If Not (skipInternalColumns And IsInternalHeader(CStr(lc.Name))) Then
            Dim hasFormulaState As Variant
            hasFormulaState = Null
            On Error Resume Next
            hasFormulaState = lc.DataBodyRange.HasFormula
            On Error GoTo 0

            If VarType(hasFormulaState) = vbBoolean Then
                If Not CBool(hasFormulaState) Then userInputColumns.Add lc
            Else
                userInputColumns.Add lc
            End If
        End If
    Next lc

    Set GetUserInputColumns = userInputColumns
End Function

Private Function IsInternalHeader(ByVal headerText As String) As Boolean
    Dim trimmedHeader As String
    trimmedHeader = LCase$(Trim$(headerText))

    IsInternalHeader = (Left$(trimmedHeader, 2) = "zz")
End Function

Private Function IsLineStartValue(ByVal valueInCell As Variant) As Boolean
    If IsError(valueInCell) Then Exit Function
    If IsEmpty(valueInCell) Then Exit Function

    If IsNumeric(valueInCell) Then
        IsLineStartValue = (CDbl(valueInCell) = 1#)
    Else
        IsLineStartValue = (Trim$(CStr(valueInCell)) = "1")
    End If
End Function

Private Function NewStableKey() As String
    On Error Resume Next
    Dim guid As String
    guid = CStr(CreateObject("Scriptlet.TypeLib").GUID)
    On Error GoTo 0

    If Len(guid) >= 38 Then
        NewStableKey = Mid$(guid, 2, 36)
    Else
        Randomize
        NewStableKey = Format$(Now, "yyyymmddhhnnss") & _
                       "-" & Right$("00000000" & Hex$(CLng(Rnd() * 2147483647#)), 8) & _
                       "-" & Right$("00000000" & Hex$(CLng(Rnd() * 2147483647#)), 8)
    End If
End Function

Private Function EnsureInternalColumn(ByVal lo As ListObject, ByVal headerName As String) As ListColumn
    Set EnsureInternalColumn = GetListColumn(lo, headerName)

    If EnsureInternalColumn Is Nothing Then
        Set EnsureInternalColumn = lo.ListColumns.Add
        EnsureInternalColumn.Name = headerName
    End If

    On Error Resume Next
    EnsureInternalColumn.Range.EntireColumn.Hidden = True
    On Error GoTo 0
End Function

Private Function GetListColumn(ByVal lo As ListObject, ParamArray colNames() As Variant) As ListColumn
    Dim i As Long

    For i = LBound(colNames) To UBound(colNames)
        On Error Resume Next
        Set GetListColumn = lo.ListColumns(CStr(colNames(i)))
        On Error GoTo 0

        If Not GetListColumn Is Nothing Then Exit Function
    Next i
End Function

Private Sub ResizeListObjectDataRows(ByVal lo As ListObject, ByVal newDataRows As Long)
    Dim totalRows As Long
    totalRows = 1 + newDataRows + IIf(lo.ShowTotals, 1, 0) 'header + data + totals(if any)

    Dim newRange As Range
    Set newRange = lo.Range.Cells(1, 1).Resize(totalRows, lo.Range.Columns.Count)

    lo.Resize newRange
End Sub

Private Sub ClearOrphanedTableArea(ByVal ws As Worksheet, _
                                   ByVal startRow As Long, _
                                   ByVal endRow As Long, _
                                   ByVal firstCol As Long, _
                                   ByVal colCount As Long, _
                                   Optional ByVal keepFormats As Boolean = True)

    If endRow < startRow Then Exit Sub

    Dim rngClear As Range
    Set rngClear = ws.Range(ws.Cells(startRow, firstCol), _
                            ws.Cells(endRow, firstCol + colCount - 1))

    If keepFormats Then
        'Clear formulas/values only; leave formatting as-is.
        rngClear.ClearContents
    Else
        'Clear all contents/formatting to prevent table style carryover below table.
        rngClear.Clear
    End If
End Sub

Private Function IsBlankLike(ByVal valueInCell As Variant) As Boolean
    If IsError(valueInCell) Then
        IsBlankLike = False
        Exit Function
    End If

    If IsEmpty(valueInCell) Then
        IsBlankLike = True
        Exit Function
    End If

    IsBlankLike = (Len(Trim$(CStr(valueInCell))) = 0)
End Function

Private Function MaxLong(ByVal firstValue As Long, ByVal secondValue As Long) As Long
    If firstValue >= secondValue Then
        MaxLong = firstValue
    Else
        MaxLong = secondValue
    End If
End Function

Private Function MinLong(ByVal firstValue As Long, ByVal secondValue As Long) As Long
    If firstValue <= secondValue Then
        MinLong = firstValue
    Else
        MinLong = secondValue
    End If
End Function

Private Sub ApplyTableBottomBoundary(ByVal lo As ListObject)
    Dim edge As Border
    Set edge = lo.Range.Borders(xlEdgeBottom)

    edge.LineStyle = xlContinuous
    edge.Weight = xlThin
    edge.Color = RGB(128, 128, 128)
End Sub
