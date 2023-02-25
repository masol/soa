/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 26 Feb 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: storage

import Storage from '@file-storage/core'

class StorageProxy {
  #base
  #bDirect
  constructor (opt) {
    this.#bDirect = !!opt.direct
    delete opt.direct
    this.#base = opt.base
    delete opt.base
    Storage.config(opt)
  }
}

export default StorageProxy
