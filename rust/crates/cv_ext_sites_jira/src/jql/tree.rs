use super::{JqlClauseState, JqlGroupState, JqlNodeState};

pub(super) fn find_group_mut<'a>(
    group: &'a mut JqlGroupState,
    id: &str,
) -> Option<&'a mut JqlGroupState> {
    if group.id == id {
        return Some(group);
    }
    for child in group.children.iter_mut() {
        if let JqlNodeState::Group(nested) = child {
            if let Some(found) = find_group_mut(nested, id) {
                return Some(found);
            }
        }
    }
    None
}

pub(super) fn find_clause_mut<'a>(
    group: &'a mut JqlGroupState,
    id: &str,
) -> Option<&'a mut JqlClauseState> {
    for child in group.children.iter_mut() {
        match child {
            JqlNodeState::Clause(clause) if clause.id == id => return Some(clause),
            JqlNodeState::Group(nested) => {
                if let Some(found) = find_clause_mut(nested, id) {
                    return Some(found);
                }
            }
            _ => {}
        }
    }
    None
}

pub(super) fn remove_node_by_id(group: &mut JqlGroupState, id: &str) -> bool {
    let before = group.children.len();
    group.children.retain(|child| match child {
        JqlNodeState::Clause(clause) => clause.id != id,
        JqlNodeState::Group(nested) => nested.id != id,
    });
    if group.children.len() < before {
        return true;
    }
    for child in group.children.iter_mut() {
        if let JqlNodeState::Group(nested) = child {
            if remove_node_by_id(nested, id) {
                return true;
            }
        }
    }
    false
}
