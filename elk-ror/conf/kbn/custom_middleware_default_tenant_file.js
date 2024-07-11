async function customMiddleware(req, res, next) {
  const rorRequest = req.rorRequest;
  const metadata =
    req.rorRequest && req.rorRequest.getIdentitySession() && req.rorRequest.getIdentitySession().metadata;
  const defaultGroup = 'infosec_group';

  if (rorRequest.getPath() === '/login' && rorRequest.getMethod() === 'post') {
    if (rorRequest.getBody().username === 'admin') {
      rorRequest.setQuery('defaultGroup', defaultGroup);
    }
  }

  if (metadata && rorRequest.getPath() === '/pkp/api/info') {
    const availableGroups = metadata.availableGroups;
    if (availableGroups.some(availableGroup => availableGroup === defaultGroup)) {
      const index = availableGroups.indexOf(defaultGroup);
      const groupAvailable = index !== -1;
      if (groupAvailable) {
        availableGroups.splice(index, 1);
        availableGroups.unshift(defaultGroup);
      }

      rorRequest.enrichIdentitySessionMetadata({ availableGroups });
    }
  }

  return next();
}
