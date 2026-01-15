Public Sub GenCSV()
Dim LstCell As Range, I As Long, j As Long, SHCOUNT As Long, Counter As Long, str As String, fileSaveName As Variant
Dim FolderName As Variant
Dim ZipNAme As String
Dim newWks As Worksheet
Dim wks As Worksheet
Dim oapp As Object
'On Error GoTo Errorhandler
Application.EnableCancelKey = xlErrorHandler

' To Create a New Worksheets
    SHCOUNT = Sheets.Count
    Sheets.Add After:=Sheets(Sheets.Count)
    Sheets(SHCOUNT + 1).Select
    Sheets(SHCOUNT + 1).Name = "ApInvoicesInterface"   ' CHANGE to YOUR PRODUCT TABLE  NAME
    Worksheets(SHCOUNT + 1).Activate
    ActiveSheet.Range("A1").Select
    
    Sheets.Add After:=Sheets(Sheets.Count)
    Sheets(SHCOUNT + 2).Select
    Sheets(SHCOUNT + 2).Name = "ApInvoiceLinesInterface"  ' CHANGE to YOUR PRODUCT TABLE NAME
    Worksheets(SHCOUNT + 2).Activate
    ActiveSheet.Range("A1").Select
    
    'Select Data from each worksheet (starting with column headers) and paste it on the new worksheet created.
    'Delete the header row after pasting
    
    For Counter = 1 To SHCOUNT - 1
        Sheets(1 + Counter).Select
        ActiveSheet.Range("A1").Select
        ActiveCell.SpecialCells(xlLastCell).Select
        I = ActiveCell.Row
        ActiveSheet.Cells(I, 1).Select
        
        'Select Data from Worksheet 4(or later) and paste it on the last row in the new worksheet created. Delete the header row for wrkst 3 after pasteing
         
        'only continue if populated rows exist beneath the column headers
        ActiveSheet.Range("A5").Select
        If Selection.Value <> "" Then
        
' this next section determines the last column and row for each sheet, it assumes your column
' headers are completely filled and that the first column in your sheet is mandatory. The two
'  "SheetLast*" variables are used later to fill all rows with an extra value to represent the end of the
' line.   It is recommended to uptake this to avoid mishandling of the windows line feeds Excel will
' store in the CSV (which can result in "Invalid Number" from SQL*Loader if last column is a number,
' or incorrect text if character.
           ' find max column and row for each sheet (for END fill)
           ActiveSheet.Range("A4").Select  '
           Selection.End(xlDown).Select
           SheetLastRow = ActiveCell.Row - 4
        
           ActiveSheet.Range("A4").Select
           Selection.End(xlToRight).Select
           SheetLastColumn = ActiveCell.Column

           ActiveSheet.Range("A4").Select
           ActiveSheet.Range(Selection, Selection.End(xlToRight)).Select
           ActiveSheet.Range(Selection, Selection.End(xlDown)).Select
           Selection.Copy
           Sheets(SHCOUNT + Counter).Select
           ActiveSheet.Paste
           Application.CutCopyMode = False
           ActiveSheet.Rows("1:1").Select
           Selection.Delete Shift:=xlUp
' This is where previously derived  "SheetLast*" variables are used later to "END" fill an extra column
' to avoid the windows line feed issues in the csv.
           'end fill last column to avoid line feed issues between windows/unix
           Sheets(3 + Counter).Select
           Range(Cells(1, SheetLastColumn + 1), Cells(SheetLastRow, SheetLastColumn + 1)).FormulaR1C1 = "END"
           ActiveSheet.Range("A1").Select
         Else
           Sheets(SHCOUNT + Counter).Select
           End If
    Next Counter

    '  New code to create empty ZIP file and then loop through the CSV sheets to add them
    'Create a Empty Zip File
    'Select Folder to ZIP the CSV File
    FolderName = Application.GetSaveAsFilename("apinvoiceimport", "Zip Files (*.zip), *.zip ", , "Please select a location and file name for ZIP File") '' CHANGE to YOUR PRODUCT ZIP NAME
    'Open a Empty ZIP
    Open FolderName For Output As #1
    Print #1, Chr$(80) & Chr$(75) & Chr$(5) & Chr$(6) & String(18, 0)
    Close #1
    
    'OriginalWorkbook.Activate
    'For the number of Sheets convert each into its own CSV file
    ReDim file_name_array(2 * (SHCOUNT + 1)) As String
    Dim array_index As Long
    array_index = 0
    
    
    For Counter = 1 To SHCOUNT - 1
    
         'Export as CSV to the root folder
         Set wks = ActiveWorkbook.Worksheets(SHCOUNT + Counter)
         wks.Copy 'to a new workbook
         Set newWks = ActiveSheet
         With newWks
            fileSaveName = Application.GetSaveAsFilename(newWks.Name, _
            fileFilter:="CSV Files (*.csv), *.csv")
            'ActiveWorkbook.SaveAs (fileSaveName)
            '.SaveAs Filename:=fileSaveName, FileFormat:=xlCSV
            'Modifications for UTF8 Character Encoding
            'saving first as unicode txt separated by tabs to fileSaveName_1
            fileSaveName_1 = fileSaveName + "_1"
            .SaveAs Filename:=fileSaveName_1, FileFormat:=xlUnicodeText
            'the unicode text is populated to a byte array, which is then loaded to a string,tabs replaced with "," and then copied to the csv file fileSaveName
            WriteBToSToBFile fileSaveName, fileSaveName_1
            ZipNAme = newWks.Name
            
            file_name_array(array_index) = fileSaveName & ""
            array_index = array_index + 1
            
            file_name_array(array_index) = fileSaveName_1 & ""
            array_index = array_index + 1
            
            If fileSaveName <> False Then
                'newWks.Delete
                'MsgBox "Save as " & fileSaveName
            End If
            
            .Parent.Close savechanges:=False
        End With
        
        ''Add the created CSV file to the ZIP file
        Set oapp = CreateObject("Shell.Application")
        oapp.Namespace(FolderName).CopyHere fileSaveName
        
    Next Counter
       
MsgBox "CSV and ZIP file have been created."
' Code for deleting the tmp csv files
For Counter = 0 To array_index - 1
    Kill file_name_array(Counter)
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
    If LenB(Dir(path)) Then ''// Does file exist?
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

