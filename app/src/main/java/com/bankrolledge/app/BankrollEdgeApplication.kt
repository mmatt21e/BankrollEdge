package com.bankrolledge.app

import android.app.Application
import com.bankrolledge.app.data.AppContainer

class BankrollEdgeApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
