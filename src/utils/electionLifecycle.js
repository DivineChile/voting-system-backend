export function canModifyElectionStructure(status) {
  return status === 'draft';
}

export function getElectionLockedMessage(status) {
  if (status === 'published') {
    return 'Published elections are locked and can no longer be edited.';
  }

  if (status === 'closed') {
    return 'Closed elections are locked and cannot be edited.';
  }

  if (status === 'active') {
    return 'Active elections are locked and cannot be edited while voting is ongoing.';
  }

  return 'This election cannot be edited in its current state.';
}