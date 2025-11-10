const buildBaseUrl = () => {
  const base = (process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5000').trim();
  return base.replace(/\/$/, '');
};

const ensureLeadingSlash = (value) => {
  if (!value) {
    return null;
  }
  return value.startsWith('/') ? value : `/${value}`;
};

const buildMediaUrl = (value) => {
  if (!value) {
    return null;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  const baseUrl = buildBaseUrl();
  const path = ensureLeadingSlash(value);
  return `${baseUrl}${path}`;
};

const formatInstructorMetadata = (raw = {}) => {
  if (!raw) {
    return null;
  }

  return {
    id: raw.id ?? raw.instructor_id ?? null,
    first_name: raw.first_name ?? raw.instructor_first_name ?? null,
    last_name: raw.last_name ?? raw.instructor_last_name ?? null,
    email: raw.email ?? raw.instructor_email ?? null,
    title: raw.title ?? raw.instructor_title ?? null,
    organization: raw.organization ?? raw.instructor_organization ?? null,
    bio: raw.bio ?? raw.instructor_bio ?? null,
    avatar: buildMediaUrl(raw.profile_picture || raw.instructor_profile_picture || null)
  };
};

module.exports = {
  buildMediaUrl,
  formatInstructorMetadata
};

