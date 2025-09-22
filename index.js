#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import Db from 'better-sqlite3'

const ASSETS_DATABASE_DIRECTORY = `${process.env.HOME}/Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary`
const ANNOTATIONS_DATABASE_DIRECTORY = `${process.env.HOME}/Library/Containers/com.apple.iBooksX/Data/Documents/AEAnnotation`

import { readdir } from 'fs/promises'

const getDatabaseFile = async (directory) => {
  let databaseFile
  let files

  try {
    files = await readdir(directory)
  } catch (e) {
    throw new Error(`Cannot access directory: ${directory}`)
  }

  const dbFilename = files
    .filter((filename) => filename.endsWith('.sqlite'))
    .slice(-1)

  if (dbFilename.length === 0) {
    throw new Error(`No SQLite database found in ${directory}`)
  }

  databaseFile = `${directory}/${dbFilename}`
  return databaseFile
}

const getAssetsData = async () => {
  const assetsDatabaseFile = await getDatabaseFile(ASSETS_DATABASE_DIRECTORY)
  const dbAssets = new Db(assetsDatabaseFile)

  const assets = dbAssets
    .prepare(
      `SELECT
      ZASSETID as id, ZTITLE AS title, ZAUTHOR AS author, ZLANGUAGE as language, ZPATH as path
      FROM ZBKLIBRARYASSET
      WHERE ZTITLE IS NOT NULL`,
    )
    .all()

  dbAssets.close()
  return assets
}

const getCollectionsData = async () => {
  const assetsDatabaseFile = await getDatabaseFile(ASSETS_DATABASE_DIRECTORY)
  const dbAssets = new Db(assetsDatabaseFile)

  const assets = dbAssets
    .prepare(
      `SELECT
      ZASSETID as id, ZTITLE AS title, ZAUTHOR AS author, ZLANGUAGE as language, ZPATH as path
      FROM ZBKLIBRARYASSET
      WHERE ZTITLE IS NOT NULL`,
    )
    .all()

  const collections = dbAssets
    .prepare(
      `SELECT
      ZCOLLECTIONID as id, ZTITLE AS title, Z_PK as pk
      FROM ZBKCOLLECTION
      WHERE Z_PK > 8`,
    )
    .all()

  const members = dbAssets
    .prepare(
      `SELECT
    ZCOLLECTION as id, ZASSETID as assetId
    FROM ZBKCOLLECTIONMEMBER
    WHERE ZCOLLECTION > 8`,
    )
    .all()

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
  const dbAssets = new Db(assetsDatabaseFile)

  const assets = dbAssets
    .prepare(
      `SELECT
      ZASSETID as id, ZTITLE AS title, ZAUTHOR AS author, ZLANGUAGE as language, ZPATH as path
      FROM ZBKLIBRARYASSET
      WHERE ZTITLE IS NOT NULL`,
    )
    .all()

  dbAssets.close()

  const annotationsDatabaseFile = await getDatabaseFile(
    ANNOTATIONS_DATABASE_DIRECTORY,
  )
  const dbAnnotations = new Db(annotationsDatabaseFile)

  const annotations = dbAnnotations
    .prepare(
      `SELECT
      ZANNOTATIONASSETID as assetId, ZANNOTATIONSELECTEDTEXT as selectedText, ZFUTUREPROOFING5 as chapter, ZANNOTATIONCREATIONDATE as creationDate, ZANNOTATIONMODIFICATIONDATE as modificationDate
      FROM ZAEANNOTATION
      WHERE ZANNOTATIONDELETED = 0 AND ZANNOTATIONSELECTEDTEXT NOT NULL`,
    )
    .all()

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
        description: 'Get all books from Apple Books library',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_collections',
        description: 'Get all collections and their books from Apple Books',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_annotations',
        description: 'Get all annotations/highlights from Apple Books',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_book_list',
        description: "Get a simple list of books in 'Author - Title' format",
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'search_books',
        description: 'Search for books by title or author',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for title or author',
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
        const assets = await getAssetsData()
        const query = args.query.toLowerCase()
        const results = assets.filter(
          (asset) =>
            asset.title?.toLowerCase().includes(query) ||
            asset.author?.toLowerCase().includes(query),
        )
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
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Apple Books MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
