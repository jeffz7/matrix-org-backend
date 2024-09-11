import neo4j from 'neo4j-driver';

export const createDriver = (
  uri: string,
  username: string,
  password: string,
) => {
  return neo4j.driver(uri, neo4j.auth.basic(username, password));
};
