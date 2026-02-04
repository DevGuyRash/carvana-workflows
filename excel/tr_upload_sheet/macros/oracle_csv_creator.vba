Public Sub GenCSV()
    Dim LstCell As Range, I As Long, j As Long, SHCOUNT As Long, Counter As Long, str As String, fileSaveName As Variant
    Dim FolderName As Variant
    Dim ZipNAme As String
    Dim newWks As Worksheet
    Dim wks As Worksheet
    Dim oapp As Object

    Dim SheetLastRow As Long
    Dim SheetLastColumn As Long
    Dim fileSaveName_1 As Variant
    Dim file_name_array() As String
    Dim array_index As Long
    Dim errCells As Range

    Application.EnableCancelKey = xlErrorHandler

    ' To Create a New Worksheets
    SHCOUNT = Sheets.Count
    Sheets.Add After:=Sheets(Sheets.Count)
    Sheets(SHCOUNT + 1).Select
    Sheets(SHCOUNT + 1).Name = "ApInvoicesInterface"
    Worksheets(SHCOUNT + 1).Activate
    ActiveSheet.Range("A1").Select

    Sheets.Add After:=Sheets(Sheets.Count)
    Sheets(SHCOUNT + 2).Select
    Sheets(SHCOUNT + 2).Name = "ApInvoiceLinesInterface"
    Worksheets(SHCOUNT + 2).Activate
    ActiveSheet.Range("A1").Select

    'Select Data from each worksheet (starting with column headers) and paste it on the new worksheet created.
    'Delete the header row after pasting
    For Counter = 1 To SHCOUNT - 1
        Dim src As Worksheet, dst As Worksheet
        Dim lastRow As Long, lastCol As Long
        Dim rng As Range
        Dim dataRows As Long

        Set src = Worksheets(1 + Counter)
        Set dst = Worksheets(SHCOUNT + Counter)   'the new interface sheet

        'only continue if populated rows exist beneath the column headers
        If Len(src.Range("A5").Value2) > 0 Then

            'last row in column A
            lastRow = src.Cells(src.Rows.Count, "A").End(xlUp).Row

            'last column in header row (row 4)
            lastCol = src.Cells(4, src.Columns.Count).End(xlToLeft).Column

            'block includes header row (row 4)
            Set rng = src.Range(src.Cells(4, 1), src.Cells(lastRow, lastCol))

            'paste values to destination starting A1
            dst.Range("A1").Resize(rng.Rows.Count, rng.Columns.Count).Value = rng.Value

            'remove header row
            dst.Rows(1).Delete

            'how many data rows remain?
            dataRows = rng.Rows.Count - 1
            If dataRows > 0 Then
                dst.Range(dst.Cells(1, lastCol + 1), dst.Cells(dataRows, lastCol + 1)).Value2 = "END"
            End If
        End If
    Next Counter

    'Select Folder to ZIP the CSV File
    FolderName = Application.GetSaveAsFilename("apinvoiceimport", "Zip Files (*.zip), *.zip ", , "Please select a location and file name for ZIP File")
    If FolderName = False Then Exit Sub

    'Create a Empty Zip File
    Open FolderName For Output As #1
    Print #1, Chr$(80) & Chr$(75) & Chr$(5) & Chr$(6) & String(18, 0)
    Close #1

    'For the number of Sheets convert each into its own CSV file
    ReDim file_name_array(2 * (SHCOUNT + 1)) As String
    array_index = 0

    For Counter = 1 To SHCOUNT - 1

        Set wks = ActiveWorkbook.Worksheets(SHCOUNT + Counter)
        wks.Copy 'to a new workbook
        Set newWks = ActiveSheet

        With newWks
            ' SAFEGUARD: force values in the export workbook too
            .UsedRange.Value = .UsedRange.Value

            ' SAFEGUARD: if any Excel error values exist, stop (prevents "#REF!" / "#VALUE!" in CSV)
            Set errCells = Nothing
            On Error Resume Next
            Set errCells = .UsedRange.SpecialCells(xlCellTypeConstants, xlErrors)
            On Error GoTo 0
            If Not errCells Is Nothing Then
                MsgBox "ERROR: Sheet '" & .Name & "' contains Excel error values (#REF!, #VALUE!, etc.)." & vbCrLf & _
                       "Fix the source data/formulas before exporting, otherwise those errors will be written into the CSV.", vbCritical
                .Parent.Close savechanges:=False
                Exit Sub
            End If

            fileSaveName = Application.GetSaveAsFilename(.Name, fileFilter:="CSV Files (*.csv), *.csv")
            If fileSaveName = False Then
                .Parent.Close savechanges:=False
                Exit For
            End If

            fileSaveName_1 = fileSaveName & "_1"

            ' saving first as unicode txt separated by tabs to fileSaveName_1
            .SaveAs Filename:=fileSaveName_1, FileFormat:=xlUnicodeText

            ' convert to UTF-8 CSV
            WriteBToSToBFile fileSaveName, fileSaveName_1

            ZipNAme = .Name

            file_name_array(array_index) = fileSaveName & ""
            array_index = array_index + 1

            file_name_array(array_index) = fileSaveName_1 & ""
            array_index = array_index + 1

            .Parent.Close savechanges:=False
        End With

        'Add the created CSV file to the ZIP file
        Set oapp = CreateObject("Shell.Application")
        oapp.Namespace(FolderName).CopyHere fileSaveName

    Next Counter

    MsgBox "CSV and ZIP file have been created."

    ' Code for deleting the tmp csv files
    For Counter = 0 To array_index - 1
        If Len(Dir(file_name_array(Counter))) > 0 Then
            Kill file_name_array(Counter)
        End If
    Next Counter

Errorhandler:
    If Err = 18 Then
       Resume
    End If

End Sub

Public Function GetFileBytes(ByVal path As Variant) As Byte()
    Dim lngFileNum As Long
    Dim bytRtnVal() As Byte
    lngFileNum = FreeFile
    If LenB(Dir(path)) Then
        Open path For Binary Access Read As lngFileNum
        ReDim bytRtnVal(LOF(lngFileNum) - 1&) As Byte
        Get lngFileNum, , bytRtnVal
        Close lngFileNum
    Else
        Err.Raise 53
    End If
    GetFileBytes = bytRtnVal
    Erase bytRtnVal
End Function

Public Function WriteBToSToBFile(fileSaveName As Variant, readFrom As Variant)
    Dim byteA() As Byte

    byteA = GetFileBytes(readFrom)

    Dim ds As String
    Dim ts As String

    ds = byteA
    ts = Left(ds, 2)
    ds = Right(ds, Len(ds) - 1)

    ds = VBA.Replace(ds, ChrW(9), ChrW(44))
    ds = VBA.Replace(ds, ChrW(34) & ChrW(34) & ChrW(34), ChrW(34))

    Dim fsT
    Set fsT = CreateObject("ADODB.Stream")
    fsT.Type = 2
    fsT.Charset = "UTF-8"
    fsT.Open
    fsT.WriteText ds

    fsT.Position = 3 'skip BOM
    Dim BinaryStream As Object
    Set BinaryStream = CreateObject("ADODB.Stream")
    BinaryStream.Type = 1
    BinaryStream.Open
    fsT.CopyTo BinaryStream
    BinaryStream.SaveToFile fileSaveName, 2
    BinaryStream.Flush
    BinaryStream.Close

    fsT.Flush
    fsT.Close
End Function


