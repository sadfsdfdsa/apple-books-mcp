#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import initSqlJs from 'sql.js'
import { readFile } from 'fs/promises'

const ASSETS_DATABASE_DIRECTORY = `${process.env.HOME}/Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary`
const ANNOTATIONS_DATABASE_DIRECTORY = `${process.env.HOME}/Library/Containers/com.apple.iBooksX/Data/Documents/AEAnnotation`

import { readdir } from 'fs/promises'

const getDatabaseFile = async (directory) => {
  let databaseFile
  let files

  try {
    files = await readdir(directory)
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new Error(
        `Apple Books directory not found at ${directory}. Please ensure Apple Books is installed and has been opened at least once.`,
      )
    }
    if (e.code === 'EACCES') {
      throw new Error(
        `Permission denied accessing ${directory}. Please check your system permissions.`,
      )
    }
    throw new Error(`Cannot access directory ${directory}: ${e.message}`)
  }

  const dbFilename = files
    .filter((filename) => filename.endsWith('.sqlite'))
    .slice(-1)

  if (dbFilename.length === 0) {
    throw new Error(
      `No SQLite database found in ${directory}. Please ensure Apple Books has been opened at least once to create the database.`,
    )
  }

  databaseFile = `${directory}/${dbFilename}`
  return databaseFile
}

const getAssetsData = async () => {
  const assetsDatabaseFile = await getDatabaseFile(ASSETS_DATABASE_DIRECTORY)
  const SQL = await initSqlJs()
  const fileBuffer = await readFile(assetsDatabaseFile)
  const dbAssets = new SQL.Database(fileBuffer)

  const result = dbAssets.exec(
    `SELECT
    ZASSETID as id, ZTITLE AS title, ZAUTHOR AS author, ZLANGUAGE as language, ZPATH as path
    FROM ZBKLIBRARYASSET
    WHERE ZTITLE IS NOT NULL`,
  )

  dbAssets.close()

  if (result.length === 0) return []

  const columns = result[0].columns
  const values = result[0].values

  return values.map((row) => {
    const obj = {}
    columns.forEach((col, index) => {
      obj[col] = row[index]
    })
    return obj
  })
}

const getCollectionsData = async () => {
  const assetsDatabaseFile = await getDatabaseFile(ASSETS_DATABASE_DIRECTORY)
  const SQL = await initSqlJs()
  const fileBuffer = await readFile(assetsDatabaseFile)
  const dbAssets = new SQL.Database(fileBuffer)

  const assetsResult = dbAssets.exec(
    `SELECT
    ZASSETID as id, ZTITLE AS title, ZAUTHOR AS author, ZLANGUAGE as language, ZPATH as path
    FROM ZBKLIBRARYASSET
    WHERE ZTITLE IS NOT NULL`,
  )

  const assets =
    assetsResult.length > 0
      ? assetsResult[0].values.map((row) => {
          const obj = {}
          assetsResult[0].columns.forEach((col, index) => {
            obj[col] = row[index]
          })
          return obj
        })
      : []

  const collectionsResult = dbAssets.exec(
    `SELECT
    ZCOLLECTIONID as id, ZTITLE AS title, Z_PK as pk
    FROM ZBKCOLLECTION
    WHERE Z_PK > 8`,
  )

  const collections =
    collectionsResult.length > 0
      ? collectionsResult[0].values.map((row) => {
          const obj = {}
          collectionsResult[0].columns.forEach((col, index) => {
            obj[col] = row[index]
          })
          return obj
        })
      : []

  const membersResult = dbAssets.exec(
    `SELECT
    ZCOLLECTION as id, ZASSETID as assetId
    FROM ZBKCOLLECTIONMEMBER
    WHERE ZCOLLECTION > 8`,
  )

  const members =
    membersResult.length > 0
      ? membersResult[0].values.map((row) => {
          const obj = {}
          membersResult[0].columns.forEach((col, index) => {
            obj[col] = row[index]
          })
          return obj
        })
      : []

  const collectionsWithMembers = []

  for (const collection of collections) {
    const assetsInCollection = {
      id: collection.id,
      pk: collection.pk,
      title: collection.title,
      members: [],
    }

    const collectionMembers = members.filter((m) => m.id == collection.pk)

    for (const member of collectionMembers) {
      const asset = assets.filter((a) => a.id == member.assetId)
      if (asset) {
        assetsInCollection.members.push(asset)
      }
    }

    collectionsWithMembers.push(assetsInCollection)
  }

  dbAssets.close()
  return collectionsWithMembers
}

const getAnnotationsData = async () => {
  const assetsDatabaseFile = await getDatabaseFile(ASSETS_DATABASE_DIRECTORY)
  const SQL = await initSqlJs()
  const fileBuffer = await readFile(assetsDatabaseFile)
  const dbAssets = new SQL.Database(fileBuffer)

  const assetsResult = dbAssets.exec(
    `SELECT
    ZASSETID as id, ZTITLE AS title, ZAUTHOR AS author, ZLANGUAGE as language, ZPATH as path
    FROM ZBKLIBRARYASSET
    WHERE ZTITLE IS NOT NULL`,
  )

  const assets =
    assetsResult.length > 0
      ? assetsResult[0].values.map((row) => {
          const obj = {}
          assetsResult[0].columns.forEach((col, index) => {
            obj[col] = row[index]
          })
          return obj
        })
      : []

  dbAssets.close()

  const annotationsDatabaseFile = await getDatabaseFile(
    ANNOTATIONS_DATABASE_DIRECTORY,
  )
  const annotationsBuffer = await readFile(annotationsDatabaseFile)
  const dbAnnotations = new SQL.Database(annotationsBuffer)

  const annotationsResult = dbAnnotations.exec(
    `SELECT
    ZANNOTATIONASSETID as assetId, ZANNOTATIONSELECTEDTEXT as selectedText, ZFUTUREPROOFING5 as chapter, ZANNOTATIONCREATIONDATE as creationDate, ZANNOTATIONMODIFICATIONDATE as modificationDate
    FROM ZAEANNOTATION
    WHERE ZANNOTATIONDELETED = 0 AND ZANNOTATIONSELECTEDTEXT NOT NULL`,
  )

  const annotations =
    annotationsResult.length > 0
      ? annotationsResult[0].values.map((row) => {
          const obj = {}
          annotationsResult[0].columns.forEach((col, index) => {
            obj[col] = row[index]
          })
          return obj
        })
      : []

  const annotationsBook = []

  for (const annotation of annotations) {
    const asset = assets.filter((a) => a.id == annotation.assetId)
    annotationsBook.push({
      assetId: annotation.assetId,
      selectedText: annotation.selectedText,
      chapter: annotation.chapter,
      creationDate: annotation.creationDate,
      modificationDate: annotation.modificationDate,
      asset: asset,
    })
  }

  dbAnnotations.close()
  return annotationsBook
}

const server = new Server(
  {
    name: 'apple-books-mcp',
    version: '1.0.0',
    description:
      'Access your Apple Books library, collections, and annotations directly through MCP',
    vendor: 'apple-books-mcp',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_books',
        description:
          'Retrieve a comprehensive list of all books in your Apple Books library, including metadata like title, author, language, and file path',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_collections',
        description:
          'Get all custom collections from Apple Books along with the books they contain. Collections help organize your library into categories like "To Read", "Favorites", etc.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_annotations',
        description:
          'Retrieve all highlights and annotations from your Apple Books, including the selected text, chapter information, and associated book metadata. Perfect for reviewing your reading notes',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_book_list',
        description:
          "Get a simplified, readable list of all books formatted as 'Author - Title'. Useful for quick overview or sharing your reading list",
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'search_books',
        description:
          'Search your Apple Books library by title or author name. Returns matching books with their complete metadata. Case-insensitive partial matching supported',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Search term to match against book titles and author names (case-insensitive, partial matches supported)',
            },
          },
          required: ['query'],
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'get_books': {
        const assets = await getAssetsData()
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(assets, null, 2),
            },
          ],
        }
      }

      case 'get_collections': {
        const collections = await getCollectionsData()
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(collections, null, 2),
            },
          ],
        }
      }

      case 'get_annotations': {
        const annotations = await getAnnotationsData()
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(annotations, null, 2),
            },
          ],
        }
      }

      case 'get_book_list': {
        const assets = await getAssetsData()
        const authorTitleList = assets.map((asset) => {
          const author = asset.author || 'Unknown Author'
          const title = asset.title || 'Unknown Title'
          return `${author} - ${title}`
        })
        return {
          content: [
            {
              type: 'text',
              text: authorTitleList.join('\n'),
            },
          ],
        }
      }

      case 'search_books': {
        if (!args.query || args.query.trim() === '') {
          throw new Error('Search query cannot be empty')
        }

        const assets = await getAssetsData()
        const query = args.query.toLowerCase().trim()
        const results = assets.filter(
          (asset) =>
            asset.title?.toLowerCase().includes(query) ||
            asset.author?.toLowerCase().includes(query),
        )

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No books found matching "${args.query}". Try a different search term or use get_books to see all available books.`,
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    console.error(`Error in tool ${name}:`, error)

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    }
  }
})

async function main() {
  try {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('Apple Books MCP server is running successfully')
    console.error(
      `Serving tools: get_books, get_collections, get_annotations, get_book_list, search_books`,
    )
  } catch (error) {
    console.error('Failed to start Apple Books MCP server:', error.message)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
