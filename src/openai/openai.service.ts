import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(@Inject('NEO4J_DRIVER') private readonly neo4jDriver) {
    // Initialize OpenAI with the API key from environment variables
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Function to generate Cypher query using GPT-4
  async generateCypherQuery(
    question: string,
    history: any[] = [],
  ): Promise<any> {
    const schema = await this.generateSchema();
    const systemMessage = `

  Task: Generate Cypher queries to query a Neo4j graph database based on the provided schema and model definitions.
  
  Here is the Schema: ${schema}

  Instructions:
    - Use only the provided node labels, relationship types, and properties from the schema.
    - The model includes nodes for **Units** (with multiple types like BusinessUnit, Department, and Project), **Employees**, **Roles**, **Assignments**, and other related entities.
    - The **Assignment** node is a **context node** that links **Employees** to the **Units** they are working on (Projects, Departments, etc.) and allows tracking of their roles and reporting structure within a unit. It is key to answering questions like "Which employees are working on a project?" or "What roles are employees assigned to within a project?"
    - **Assignment** also captures time-related data such as **startDate** and **endDate** to track when an employee was assigned to a specific project or unit. Queries should leverage this context to get historical and current data on assignments.
    - Relationships include:
      - **BELONGS_TO_UNIT**: Links an Employee to the lowest possible unit they belong to (BusinessUnit, Department, or Project).
      - **HAS_ROLE**: Links an Employee or Assignment to a specific Role.
      - **ASSIGNED**: Links an Employee to an Assignment. The **Assignment** node is where employee-specific information for a project or unit (like role and reporting structure) is stored.
      - **ASSIGNED_TO_UNIT**: Links an Assignment to a Unit (BusinessUnit, Department, or Project). This relationship helps define which project or unit the assignment belongs to.
      - **REPORTS_TO**: Links an Employee’s Assignment to a Manager or Reporting Employee within that project or unit.
      - **MANAGED_BY_TALENT**: Links an Employee to a Talent Manager.
      - **MANAGED_BY_FUNCTIONAL**: Links an Employee to a Functional Manager.
      - **USES_SKILL**: Links a Unit (Project or Department) to a Skill.
    - **Contextual Use of Assignment Node**:
      - To retrieve information about which employees are working on a specific project or department, use the **Assignment** node and its relationships to both **Employee** and **Unit** (which can be a **Project**, **Department**, or **BusinessUnit**).
      - The **Assignment** node stores key context about an employee’s role, reporting structure, and time period within a unit. Queries should use the **Assignment** node to get granular data about project roles and participation, while filtering by start and end dates to capture historical assignments.
      - Example: To find employees working on a project and their roles, use the **ASSIGNED** relationship between **Employee** and **Assignment**, and then the **ASSIGNED_TO_UNIT** relationship from **Assignment** to the **Unit** (Project).
    - Always include the full **nodes and relationships** when querying. Ensure that you **return both the nodes and all the relationships** used in the query.
    - Avoid querying only specific properties. Always return the nodes and relationships in the Cypher query pattern.
    - Ensure that traversal queries respect relationship directions where necessary (e.g., for **REPORTS_TO**).
    - For nodes that support multiple labels (e.g., **Unit** having BusinessUnit, Department, or Project), ensure that Cypher queries use the correct additional labels for filtering and queries.
    - Take into account that some nodes (like employees or managers) may belong to multiple units or roles over time, and query historical data when necessary by including relationships with start and end dates.
    - For querying hierarchies, make sure to follow paths recursively if necessary (e.g., **BELONGS_TO_UNIT** for sub-units).
    
**Important**: use variable names for all relationships and nodes in the query and return all those relationships and nodes in the query.
 For example: MATCH (e1:Employee {Name: 'Rijo'})-[r1:ASSIGNED]->(a1:Assignment)-[r2:ASSIGNED_TO_UNIT]->(u:Unit)<-[r3:ASSIGNED_TO_UNIT]-(a2:Assignment)<-[r4:ASSIGNED]-(e2:Employee {Name: 'Jimmey'}) RETURN e1, a1, u, a2, e2, r1,r2,r3,r4
  **Important**: Return your result in **only** the following JSON structure. Do not provide any additional explanations or code formatting. 
  Ensure that **all nodes and relationships** are returned in the Cypher query.

  {
      "status": "success" | "error",
      "rawCypher": "<cypher_query>"
  }
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: question },
        ...history,
      ],
      temperature: 0.0,
      max_tokens: 1000,
    });

    return response.choices[0].message.content;
  }

  // Function to generate schema for Neo4j
  async generateSchema(): Promise<string> {
    const session = this.neo4jDriver.session();
    const nodeProps = await session.run(`
      CALL apoc.meta.data()
      YIELD label, elementType, type, property
      WHERE NOT type = "RELATIONSHIP" AND elementType = "node"
      WITH label AS nodeLabels, collect(property) AS properties
      RETURN {labels: nodeLabels, properties: properties} AS output
    `);

    const relProps = await session.run(`
      CALL apoc.meta.data()
      YIELD label, elementType, type, property
      WHERE NOT type = "RELATIONSHIP" AND elementType = "relationship"
      WITH label AS nodeLabels, collect(property) AS properties
      RETURN {type: nodeLabels, properties: properties} AS output
    `);

    const rels = await session.run(`
      CALL apoc.meta.data()
      YIELD label, other, elementType, type, property
      WHERE type = "RELATIONSHIP" AND elementType = "node"
      RETURN {source: label, relationship: property, target: other} AS output
    `);

    return `
      This is the schema representation of the Neo4j database.
      Node properties are the following:
      ${JSON.stringify(nodeProps, null, 2)}
      Relationship properties are the following:
      ${JSON.stringify(relProps, null, 2)}
      Relationships between source and target nodes:
      ${JSON.stringify(rels, null, 2)}
    `;
  }

  async formatResponse(result: any): Promise<any> {
    const entities = [];
    const relations = [];
    console.log('>>> result: ', result);

    result?.records.forEach((record) => {
      record.forEach((entry) => {
        // Check if the entry is a node
        if (entry.identity && entry.labels) {
          entities.push({
            id: entry.identity.toInt(), // Convert BigInt to a regular number
            type: entry.labels[0], // First label is used as the type
            metaData: entry.properties, // Use properties of the node as metaData
          });
        }

        // Check if the entry is a relationship
        if (entry.start && entry.end && entry.type) {
          try {
            relations.push({
              from: entry.start.toInt(), // Relationship start node ID
              to: entry.end.toInt(), // Relationship end node ID
              type: entry.type, // Type of the relationship
              metaData: entry.properties || {}, // Optional metadata for relationships
            });
          } catch (error) {
            console.log('>>> error in relationship add operation', error);
          }
        }
      });
    });
    // console.log('>>> entities', entities);
    // console.log('>>> Relationship', relations);

    return { entities, relations };
  }

  // Self-healing Cypher flow
  async runCypherFlow(
    question: string,
    history: any[] = [],
    retry: boolean = true,
  ): Promise<any> {
    console.log('>>> going to generate cypher query with openai');

    const cypherQuery = await this.generateCypherQuery(question, history);
    console.log('Generated Cypher Query:', cypherQuery);

    try {
      const session = this.neo4jDriver.session();
      const query = JSON.parse(cypherQuery).rawCypher;
      console.log('>>> cypherQuery.rawCypher', query);

      const result = await session.run(query);
      console.log('>>> results length', result?.records?.length);

      const formattedResult = await this.formatResponse(result); // Format the response here
      return {
        status: 'success',
        message: 'Query executed successfully',
        data: formattedResult,
      };
    } catch (error) {
      if (!retry) {
        return {
          status: 'error',
          message: `Failed to execute Cypher query: ${error.message}`,
          rawCypher: cypherQuery,
        };
      }

      console.log('Retrying with error correction...');

      return this.runCypherFlow(
        question,
        [
          { role: 'assistant', content: cypherQuery },
          {
            role: 'user',
            content: `This query returns an error: ${error.message}. Please fix it without any explanations or apologies.`,
          },
        ],
        false,
      );
    }
  }
}
