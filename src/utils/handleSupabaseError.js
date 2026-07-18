export function handleSupabaseError(error, fallbackMessage = 'An unexpected error occurred.') {
  if (!error) {
    return {
      status: 500,
      message: fallbackMessage,
    };
  }

  const code = error.code;
  const message = error.message || '';
  const details = error.details || '';

  // PostgreSQL unique violation
  if (code === '23505') {
    if (message.includes('candidates_unique_name_per_position')) {
      return {
        status: 409,
        message: 'A candidate with this name already exists for the selected position in this election.',
      };
    }

    if (message.includes('positions_unique_title_per_election')) {
      return {
        status: 409,
        message: 'A position with this title already exists in the selected election.',
      };
    }

    if (message.includes('ballots_unique_voter_per_election')) {
      return {
        status: 409,
        message: 'This student has already voted in this election.',
      };
    }

    if (message.includes('ballot_items_unique_position_per_ballot')) {
      return {
        status: 409,
        message: 'A selection has already been made for this position in this ballot.',
      };
    }

    if (message.includes('profiles_email_key')) {
      return {
        status: 409,
        message: 'A user with this email already exists.',
      };
    }

    if (message.includes('profiles_matric_no_key')) {
      return {
        status: 409,
        message: 'A user with this matric number already exists.',
      };
    }

    return {
      status: 409,
      message: 'This record already exists and cannot be duplicated.',
    };
  }

  // PostgreSQL foreign key violation
  if (code === '23503') {
    return {
      status: 400,
      message: 'The selected related record was not found or is invalid.',
    };
  }

  // PostgreSQL not-null violation
  if (code === '23502') {
    return {
      status: 400,
      message: 'A required field is missing.',
    };
  }

  // PostgreSQL check violation
  if (code === '23514') {
    return {
      status: 400,
      message: 'One or more values provided are invalid.',
    };
  }

  // invalid input syntax / bad format
  if (code === '22P02') {
    return {
      status: 400,
      message: 'One or more values have an invalid format.',
    };
  }

  // fallback
  return {
    status: 400,
    message: details || message || fallbackMessage,
  };
}