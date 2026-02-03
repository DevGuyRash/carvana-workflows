=LET(
    REM_Selection, "Select columns directly from the Table Name",
    selected_cols, HSTACK(
        New_Title_Department_Check_Requests___Excel_Sync[INVOICE '#],
        New_Title_Department_Check_Requests___Excel_Sync[DATE],
        New_Title_Department_Check_Requests___Excel_Sync[VENDOR ID],
        New_Title_Department_Check_Requests___Excel_Sync[VENDOR NAME]
    ),

    REM_Visibility_Check, "Use MAP and SUBTOTAL to detect which rows are visible",
    check_column, New_Title_Department_Check_Requests___Excel_Sync[INVOICE '#],
    is_visible_mask, MAP(check_column, LAMBDA(x, SUBTOTAL(103, x))),

    REM_Filter, "Filter selected columns based on the visibility mask",
    FILTER(selected_cols, is_visible_mask, "No Valid Data")
)