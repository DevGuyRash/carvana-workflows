Option Explicit

'========================
' API DECLARATIONS
'========================
#If VBA7 Then
    Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
#Else
    Private Declare Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
#End If

'========================
' CONFIG
'========================
Private Const HEADER_ROW As Long = 4
Private Const FIRST_DATA_ROW As Long = 5

Private Const CSV_INV As String = "ApInvoicesInterface.csv"
Private Const CSV_LINES As String = "ApInvoiceLinesInterface.csv"

'========================
' APP STATE
'========================
Private Type TAppState
    ScreenUpdating  As Boolean
    EnableEvents    As Boolean
    DisplayAlerts   As Boolean
    Calculation     As XlCalculation
    StatusBar       As Variant
    EnableCancelKey As XlEnableCancelKey
End Type

'========================
' MAIN
'========================
Public Sub GenCSV()

    Dim wb          As Workbook
    Set wb = ActiveWorkbook

    Dim st          As TAppState
    SaveAppState st
    OptimizeForSpeed True, st
    Application.EnableCancelKey = xlErrorHandler

    Dim zipPathV    As Variant
    Dim zipPath     As String

    Dim tempFolder  As String
    Dim csvInvPath  As String, csvLinesPath As String

    On Error GoTo ErrHandler

    '--- Enforce the "2 sheets after the first" rule
    If wb.Worksheets.Count < 3 Then
        Err.Raise vbObjectError + 2000, "GenCSV", _
                  "Workbook must have at least 3 worksheets. Sheet(1) Is ignored; Sheet(2) And Sheet(3) are the sources."
    End If

    '--- Prompt ONLY for ZIP path (internal filenames are locked)
    zipPathV = Application.GetSaveAsFilename( _
    InitialFileName:="apinvoiceimport", _
    FileFilter:="Zip Files (*.zip), *.zip", _
    Title:="Please Select a location And file name For ZIP File")

    If zipPathV = FALSE Then GoTo CleanExit
    zipPath = EnsureExtension(CStr(zipPathV), ".zip")

    '--- Overwrite existing ZIP with a fresh empty one
    If Len(Dir$(zipPath)) > 0 Then
        On Error Resume Next
        SetAttr zipPath, vbNormal
        Kill zipPath
        On Error GoTo ErrHandler
    End If

    CreateEmptyZipBinary zipPath

    ' Give OS time to close the handle from the binary write
    Sleep 500

    '--- Build temp CSV paths (strict names)
    tempFolder = CreateTempFolder("apinvoiceimport_")
    csvInvPath = tempFolder & Application.PathSeparator & CSV_INV
    csvLinesPath = tempFolder & Application.PathSeparator & CSV_LINES

    '--- Export CSVs directly from Worksheet(2) and Worksheet(3)
    WriteWorksheetToInterfaceCsv wb.Worksheets(2), csvInvPath
    WriteWorksheetToInterfaceCsv wb.Worksheets(3), csvLinesPath

    '--- Add to ZIP (robust namespace wait + async wait)
    Dim shellApp    As Object
    Set shellApp = CreateObject("Shell.Application")

    ' We pass the folder and filename separately to use FolderItem objects
    AddFileToZipAndWait shellApp, zipPath, tempFolder, CSV_INV
    AddFileToZipAndWait shellApp, zipPath, tempFolder, CSV_LINES

    MsgBox "ZIP created successfully:" & vbCrLf & zipPath, vbInformation

    CleanExit:
    'cleanup temp files always
    On Error Resume Next
    If Len(csvInvPath) > 0 Then Kill csvInvPath
    If Len(csvLinesPath) > 0 Then Kill csvLinesPath
    If Len(tempFolder) > 0 Then RmDir tempFolder
    Set shellApp = Nothing
    On Error GoTo 0

    OptimizeForSpeed False, st
    Exit Sub

    ErrHandler:
    If Err.Number = 18 Then
        Resume CleanExit
    Else
        MsgBox "ERROR: " & Err.Number & vbCrLf & Err.Description, vbCritical
        Resume CleanExit
    End If

End Sub

'==========================================================
' CSV EXPORT (values-only, preserves formatting, trims, END)
'==========================================================
Private Sub WriteWorksheetToInterfaceCsv(ByVal ws As Worksheet, ByVal csvPath As String)

    Dim lastCol     As Long
    lastCol = LastColumnInRow(ws, HEADER_ROW)
    If lastCol = 0 Then
        CreateEmptyFile csvPath
        Exit Sub
    End If

    Dim lastRow     As Long
    lastRow = LastDataRowInColumns(ws, FIRST_DATA_ROW, lastCol)
    If lastRow < FIRST_DATA_ROW Then
        CreateEmptyFile csvPath
        Exit Sub
    End If

    Dim rowCount    As Long
    rowCount = lastRow - FIRST_DATA_ROW + 1

    Dim hdr         As Variant
    hdr = ws.Range(ws.Cells(HEADER_ROW, 1), ws.Cells(HEADER_ROW, lastCol)).Value2

    ' Date columns by header name (Oracle control file expects YYYY/MM/DD for these)
    Dim isDateCol() As Boolean
    ReDim isDateCol(1 To lastCol) As Boolean

    Dim c           As Long
    For c = 1 To lastCol
        Dim h       As String
        h = CleanCellString(CStr(hdr(1, c)))
        isDateCol(c) = (InStr(1, UCase$(h), "DATE", vbBinaryCompare) > 0)
    Next c

    ' Read values fast
    Dim dataRng     As Range
    Set dataRng = ws.Range(ws.Cells(FIRST_DATA_ROW, 1), ws.Cells(lastRow, lastCol))

    Dim vals        As Variant
    vals = dataRng.Value2

    ' Pre-clean string values in the array (fast)
    Dim r           As Long
    For r = 1 To rowCount
        For c = 1 To lastCol
            If IsError(vals(r, c)) Then
                Err.Raise vbObjectError + 2100, "GenCSV", _
                          "Excel Error value found in sheet        '" & ws.Name & "' at row " & (FIRST_DATA_ROW + r - 1) & _
                          ", col " & c & ". Fix #REF!/#VALUE!/etc. before exporting."
            End If
            If VarType(vals(r, c)) = vbString Then
                vals(r, c) = CleanCellString(CStr(vals(r, c)))
            End If
        Next c
    Next r

    ' Cache column formats when uniform (speed). If mixed, we fall back per-cell.
    Dim colFmt      As Variant, colFmtIsUniform() As Boolean, colFmtStr() As String
    ReDim colFmtIsUniform(1 To lastCol) As Boolean
    ReDim colFmtStr(1 To lastCol) As String

    For c = 1 To lastCol
        colFmt = ws.Range(ws.Cells(FIRST_DATA_ROW, c), ws.Cells(lastRow, c)).NumberFormat
        If IsNull(colFmt) Then
            colFmtIsUniform(c) = FALSE
            colFmtStr(c) = vbNullString
        Else
            colFmtIsUniform(c) = TRUE
            colFmtStr(c) = CStr(colFmt)
        End If
    Next c

    ' Write CSV     as UTF-8 (no BOM)
    Dim textStream  As Object, binStream As Object
    Set textStream = CreateObject("ADODB.Stream")
    textStream.Type = 2
    textStream.Charset = "UTF-8"
    textStream.Open

    Dim fields()    As String
    ReDim fields(1 To lastCol + 1) As String        ' + END

    For r = 1 To rowCount

        For c = 1 To lastCol
            Dim s   As String
            s = ValueToExportString(ws, vals(r, c), isDateCol(c), colFmtIsUniform(c), colFmtStr(c), FIRST_DATA_ROW + r - 1, c)
            fields(c) = CsvEscape(s)
        Next c

        fields(lastCol + 1) = "END"        ' final marker, no trailing delimiters beyond this

        textStream.WriteText Join(fields, ",") & vbLf
    Next r

    ' Strip BOM (skip first 3 bytes)
    If textStream.Size >= 3 Then
        textStream.Position = 3
    Else
        textStream.Position = 0
    End If

    Set binStream = CreateObject("ADODB.Stream")
    binStream.Type = 1
    binStream.Open

    textStream.CopyTo binStream
    binStream.SaveToFile csvPath, 2

    binStream.Close
    textStream.Close

End Sub

Private Function ValueToExportString(ByVal ws As Worksheet, ByVal v As Variant, ByVal isDateColumn As Boolean, _
        ByVal fmtUniform As Boolean, ByVal fmtString As String, _
        ByVal sheetRow As Long, ByVal sheetCol As Long) As String

    If IsEmpty(v) Then
        ValueToExportString = ""
        Exit Function
    End If

    If VarType(v) = vbString Then
        Dim t       As String
        t = CStr(v)
        If isDateColumn And Len(t) > 0 Then
            t = NormalizeDateStringYMD(t, ws.Name, sheetRow, sheetCol)
        End If
        ValueToExportString = t
        Exit Function
    End If

    If VarType(v) = vbBoolean Then
        ValueToExportString = IIf(CBool(v), "TRUE", "FALSE")
        Exit Function
    End If

    ' Numeric/Date serials
    If isDateColumn Then
        ' Excel stores dates as serials; always output Oracle-friendly YYYY/MM/DD
        ValueToExportString = Format$(ExcelSerialToDate(CDbl(v)), "yyyy/mm/dd")
        Exit Function
    End If

    ' Preserve numeric formatting (eg 4.0) without relying on cell width.
    Dim outS        As String
    If fmtUniform Then
        outS = SafeExcelText(v, fmtString, CStr(v))
    Else
        ' Mixed formats in this column: use actual cell's format
        outS = SafeExcelText(v, ws.Cells(sheetRow, sheetCol).NumberFormat, CStr(v))
    End If

    ValueToExportString = CleanCellString(outS)

End Function

Private Function SafeExcelText(ByVal v As Variant, ByVal fmt As String, ByVal fallback As String) As String
    On Error Resume Next
    SafeExcelText = Application.WorksheetFunction.Text(v, fmt)
    If Err.Number <> 0 Then
        Err.Clear
        SafeExcelText = fallback
    End If
    On Error GoTo 0
End Function

Private Function ExcelSerialToDate(ByVal serial As Double) As Date
    ExcelSerialToDate = DateSerial(1899, 12, 30) + serial
End Function

'==========================================================
' DATE NORMALIZATION (locale-safe; avoids CDate)
'==========================================================
Private Function NormalizeDateStringYMD(ByVal s As String, ByVal sheetName As String, ByVal rowIdx As Long, ByVal colIdx As Long) As String

    s = CleanCellString(s)
    If Len(s) = 0 Then
        NormalizeDateStringYMD = ""
        Exit Function
    End If

    ' Strip time if present
    Dim datePart    As String
    datePart = Split(s, " ")(0)
    datePart = Replace(datePart, "-", "/")

    Dim parts()     As String
    parts = Split(datePart, "/")
    If UBound(parts) <> 2 Then
        Err.Raise vbObjectError + 2200, "GenCSV", _
                  "Unrecognized Date        '" & s & "' in sheet '" & sheetName & "' at row " & rowIdx & ", col " & colIdx & "."
    End If

    If Not (IsNumeric(parts(0)) And IsNumeric(parts(1)) And IsNumeric(parts(2))) Then
        Err.Raise vbObjectError + 2201, "GenCSV", _
                  "Unrecognized Date        '" & s & "' in sheet '" & sheetName & "' at row " & rowIdx & ", col " & colIdx & "."
    End If

    Dim yy          As Long, mm As Long, dd As Long
    If Len(parts(0)) = 4 Then
        yy = CLng(parts(0)): mm = CLng(parts(1)): dd = CLng(parts(2))
    ElseIf Len(parts(2)) = 4 Then
        mm = CLng(parts(0)): dd = CLng(parts(1)): yy = CLng(parts(2))
    Else
        Err.Raise vbObjectError + 2202, "GenCSV", _
                  "Ambiguous Date        '" & s & "' in sheet '" & sheetName & "' at row " & rowIdx & ", col " & colIdx & "."
    End If

    Dim dt          As Date
    dt = DateSerial(yy, mm, dd)
    If Year(dt) <> yy Or Month(dt) <> mm Or Day(dt) <> dd Then
        Err.Raise vbObjectError + 2203, "GenCSV", _
                  "Invalid Date        '" & s & "' in sheet '" & sheetName & "' at row " & rowIdx & ", col " & colIdx & "."
    End If

    NormalizeDateStringYMD = Format$(dt, "yyyy/mm/dd")

End Function

'==========================================================
' STRING CLEANING (trim ends, normalize weird spaces, collapse doubles, newline->\n)
'==========================================================
Private Function CleanCellString(ByVal s As String) As String
    If Len(s) = 0 Then
        CleanCellString = ""
        Exit Function
    End If

    s = Replace(s, ChrW$(160), " ")        ' NBSP
    s = Replace(s, ChrW$(8239), " ")        ' narrow NBSP
    s = Replace(s, ChrW$(65279), "")        ' BOM / zero-width NBSP
    s = Replace(s, ChrW$(8203), "")        ' zero-width space

    s = Replace(s, vbTab, " ")

    s = Replace(s, vbCrLf, "")
    s = Replace(s, vbCr, "")
    s = Replace(s, vbLf, "")

    On Error Resume Next
    s = Application.WorksheetFunction.Trim(s)        ' collapses multiple internal spaces
    On Error GoTo 0

    CleanCellString = Trim$(s)

End Function

Private Function CsvEscape(ByVal s As String) As String
    If Len(s) = 0 Then
        CsvEscape = ""
        Exit Function
    End If

    Dim needsQuotes As Boolean
    needsQuotes = (InStr(1, s, ",", vbBinaryCompare) > 0) Or _
                  (InStr(1, s, """", vbBinaryCompare) > 0) Or _
                  (InStr(1, s, vbCr, vbBinaryCompare) > 0) Or _
                  (InStr(1, s, vbLf, vbBinaryCompare) > 0)

    If InStr(1, s, """", vbBinaryCompare) > 0 Then
        s = Replace(s, """", """""")
    End If

    If needsQuotes Then
        CsvEscape = """" & s & """"
    Else
        CsvEscape = s
    End If

End Function

'==========================================================
' RANGE UTILITIES
'==========================================================
Private Function LastColumnInRow(ByVal ws As Worksheet, ByVal rowNum As Long) As Long
    Dim lastCol     As Long
    lastCol = ws.Cells(rowNum, ws.Columns.Count).End(xlToLeft).Column
    If lastCol = 1 And Len(CStr(ws.Cells(rowNum, 1).Value2)) = 0 Then lastCol = 0
    LastColumnInRow = lastCol
End Function

Private Function LastDataRowInColumns(ByVal ws As Worksheet, ByVal firstDataRow As Long, ByVal lastCol As Long) As Long
    Dim rngSearch   As Range, lastCell As Range
    Set rngSearch = ws.Range(ws.Cells(firstDataRow, 1), ws.Cells(ws.Rows.Count, lastCol))

    Set lastCell = rngSearch.Find(What:="*", LookIn:=xlValues, SearchOrder:=xlByRows, SearchDirection:=xlPrevious)
    If lastCell Is Nothing Then
        LastDataRowInColumns = firstDataRow - 1
    Else
        LastDataRowInColumns = lastCell.Row
    End If

End Function

'==========================================================
' ZIP (binary header + namespace retry)
'==========================================================
Private Sub CreateEmptyZipBinary(ByVal zipPath As String)
    Dim b(0 To 21)  As Byte
    b(0) = 80        ' P
    b(1) = 75        ' K
    b(2) = 5
    b(3) = 6
    ' remaining bytes default to 0

    Dim ff          As Integer: ff = FreeFile
    Open zipPath For Binary Access Write As #ff
    Put #ff, , b
    Close #ff

End Sub

Private Sub AddFileToZipAndWait(ByVal shellApp As Object, ByVal zipPath As String, ByVal sourceFolder As String, ByVal fileName As String)

    Dim zipNs       As Object
    Dim sourceNs    As Object
    Dim sourceItem  As Object
    Dim vZipPath    As Variant
    Dim vSourceFolder As Variant

    ' 1. Convert to Variant to satisfy Shell.Namespace quirks
    vZipPath = zipPath
    vSourceFolder = sourceFolder

    ' 2. Get the Destination ZIP Namespace (with retry)
    Set zipNs = GetShellNamespaceWithRetry(shellApp, vZipPath, 5#)
    If zipNs Is Nothing Then
        Err.Raise vbObjectError + 2300, "GenCSV", "Unable To open ZIP namespace (Locked?): " & zipPath
    End If

    ' 3. Get the Source File as a FolderItem Object
    '    (Passing a String path to CopyHere is unreliable; passing a FolderItem is robust)
    Set sourceNs = shellApp.Namespace(vSourceFolder)
    If sourceNs Is Nothing Then
        Err.Raise vbObjectError + 2301, "GenCSV", "Could Not read temp source folder: " & sourceFolder
    End If

    Set sourceItem = sourceNs.ParseName(fileName)
    If sourceItem Is Nothing Then
        Err.Raise vbObjectError + 2302, "GenCSV", "Source file Not found in temp folder: " & fileName
    End If

    ' 4. CopyHere using the Object
    '    4 = FOF_SILENT (No progress dialog)
    '    16 = FOF_NOCONFIRMATION (Respond "Yes" to all)
    zipNs.CopyHere sourceItem, 20        ' 4 + 16

    ' 5. Wait for file to appear in ZIP
    If Not WaitForFileInZip(zipNs, fileName, 10#) Then
        Err.Raise vbObjectError + 2303, "GenCSV", _
                  "Timed out waiting For file To compress: " & fileName
    End If

    ' Optional: Brief cool-down to allow handle release before next add
    Sleep 250

End Sub

Private Function GetShellNamespaceWithRetry(ByVal shellApp As Object, ByVal vPath As Variant, ByVal timeoutSec As Double) As Object
    Dim t0          As Double: t0 = Timer
    Do
        On Error Resume Next
        Set GetShellNamespaceWithRetry = shellApp.Namespace(vPath)
        On Error GoTo 0

        If Not GetShellNamespaceWithRetry Is Nothing Then Exit Function

        Sleep 200        ' Yield to OS
        DoEvents

        If Timer < t0 Then t0 = t0 - 86400#        ' Handle midnight wrap
    Loop While (Timer - t0) < timeoutSec

End Function

Private Function WaitForFileInZip(ByVal zipNs As Object, ByVal fileName As String, ByVal timeoutSec As Double) As Boolean
    Dim t0          As Double: t0 = Timer
    Dim itm         As Object

    Do
        On Error Resume Next
        Set itm = zipNs.ParseName(fileName)
        On Error GoTo 0

        If Not itm Is Nothing Then
            WaitForFileInZip = TRUE
            Exit Function
        End If

        Sleep 200
        DoEvents

        If Timer < t0 Then t0 = t0 - 86400#
    Loop While (Timer - t0) < timeoutSec

    WaitForFileInZip = FALSE

End Function

Private Function FileNameFromPath(ByVal fullPath As String) As String
    Dim p           As Long
    p = InStrRev(fullPath, Application.PathSeparator)
    If p > 0 Then
        FileNameFromPath = Mid$(fullPath, p + 1)
    Else
        FileNameFromPath = fullPath
    End If
End Function

'==========================================================
' FILE / TEMP HELPERS
'==========================================================
Private Sub CreateEmptyFile(ByVal path As String)
    Dim ff          As Integer: ff = FreeFile
    Open path For Output As #ff
    Close #ff
End Sub

Private Function CreateTempFolder(ByVal prefix As String) As String
    Randomize

    Dim Base        As String
    Base = Environ$("TEMP")
    If Len(base) = 0 Then Base = Environ$("TMP")
    If Len(base) = 0 Then Base = CurDir$

    If Right$(base, 1) <> Application.PathSeparator Then Base = Base & Application.PathSeparator

    Dim folderPath  As String
    folderPath = Base & prefix & Format$(Now, "yyyymmdd_hhnnss") & "_" & CStr(CLng(Rnd() * 100000))

    MkDir folderPath
    CreateTempFolder = folderPath

End Function

Private Function EnsureExtension(ByVal path As String, ByVal ext As String) As String
    If Len(path) = 0 Then
        EnsureExtension = path
    ElseIf LCase$(Right$(path, Len(ext))) <> LCase$(ext) Then
        EnsureExtension = path & ext
    Else
        EnsureExtension = path
    End If
End Function

'==========================================================
' APP STATE / SPEED
'==========================================================
Private Sub SaveAppState(ByRef st As TAppState)
    With Application
        st.ScreenUpdating = .ScreenUpdating
        st.EnableEvents = .EnableEvents
        st.DisplayAlerts = .DisplayAlerts
        st.Calculation = .Calculation
        st.StatusBar = .StatusBar
        st.EnableCancelKey = .EnableCancelKey
    End With
End Sub

Private Sub OptimizeForSpeed(ByVal enable As Boolean, ByRef st As TAppState)
    With Application
        If enable Then
            .ScreenUpdating = FALSE
            .EnableEvents = FALSE
            .DisplayAlerts = FALSE
            .Calculation = xlCalculationManual
            .StatusBar = "Generating CSV + ZIP..."
        Else
            .ScreenUpdating = st.ScreenUpdating
            .EnableEvents = st.EnableEvents
            .DisplayAlerts = st.DisplayAlerts
            .Calculation = st.Calculation
            .StatusBar = st.StatusBar
            .EnableCancelKey = st.EnableCancelKey
        End If
    End With
End Sub