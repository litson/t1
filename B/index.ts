import {
    stat,
    readFileSync,
    outputFile
} from 'fs-extra'
import * as globby from 'fast-glob'
import * as consola from 'consola'
import * as chalk from 'chalk'
import { createHash } from 'crypto'
import * as Datastore from 'nedb'
import * as imagemin from 'imagemin'
import imageminPngquant from 'imagemin-pngquant'
import { cwd } from 'process'
import { resolve } from 'path'
import { promisify } from 'util'

const pStat = promisify(stat)

export async function main(path: string) {
    // 判断是不是文件
    const isFile = await assertIsFile(path)
    const files = isFile
        // 单文件
        ? [resolve(cwd(), path)]
        // 文件夹
        : await globby(resolve(path, '**/*.+(png|svg)'))

    // @TODO 计算每个文件的md5，过滤掉表里有的文件
    for (let i = 0; i < files.length; i++) {
        const path = files[i];
        const { size } = await pStat(path)
        // 压缩文件
        const { data, sourcePath } = await compress(path);
        const pct = (1 - (size / data.length)) * 100;
        (consola as any).success(
            chalk`${sourcePath.replace(cwd(), '')}
        ${toKb(size)} ${chalk.green('==>')} ${toKb(data.length)}
        ${pct > 0 ? chalk.red('↑↑↑') : chalk.green('⇩')}${Math.abs(pct).toFixed(2)}%`
        )
        // insertDoc(data)
        // 覆盖源文件
        await outputFile(sourcePath, data)
    }
}

function createFileHash(path: Buffer | string): string {
    const buffer = path === 'string' ? readFileSync(path) : path
    const hash = createHash('md5')
    hash.update(buffer, 'utf8');
    return hash.digest('hex');
}

function assertIsFile(path: string): Promise<boolean> {
    return new Promise((resolve, reject) =>
        stat(path, (error, stats) => {
            if (error) {
                return reject(error)
            }
            resolve(stats.isFile())
        })
    )
}

let $DB: Nedb | null = null
function getDatabase(): Nedb {
    if (!$DB) {
        $DB = new Datastore({
            filename: resolve(__dirname, './data.db')
        })
    }
    $DB.loadDatabase()
    return $DB
}

function ifExisting(path: string): Promise<boolean> {
    const md5 = createFileHash(path)
    const db = getDatabase()
    return new Promise((resolve, reject) => {
        db.find({ md5 }, (err, docs) => {
            if (err) {
                return reject(err)
            }
            resolve(docs.length !== 0)
        })
    })
}

function insertDoc(path: string) {
    const md5 = createFileHash(path)
    const db = getDatabase()
    db.insert({ md5 })
}

// 如果压缩后比压缩前还大，就不压缩了。
function wrapPngquant(options) {
    return (input) => {
        const originalSize = input.length
        const newFile = imageminPngquant(options)(input)
        return newFile.then(data => (data.length > originalSize) ? input : data)
    }
}

async function compress(path: string) {
    const datas = await imagemin([path], {
        plugins: [
            wrapPngquant({
                quality: [0.6, 0.8],
                speed: 1
            })
        ]
    })
    return datas[0]
}

function toKb(b) {
    return `${(b / 1024).toFixed(2)}kb`
}