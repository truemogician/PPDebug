# **接口说明**

## **服务器信息**
+ 协议：https  
+ 主机：www.truemogician.com  
+ 端口：1926  
+ URL：https://www.truemogician.com:1926

## **通用Http状态码**
+ 200：正常
+ 400：请求错误
+ 401：会话过期，需要重新登陆
+ 404：资源不存在
+ 409：冲突
+ 413：负载过大
+ 414：URI过长
+ 501：功能未实现

返回数据默认是在200状态下的结果，对于某些特殊的接口，会有针对其他状态码的特殊返回数据，会在开头标明

## **Get**
场景：从后端获取资源
+ ### */api/user/hasUser*
  + 说明：用户是否存在
  + 参数：

    ```ts
    email: string
    ```
  + 返回：

    ```ts
    exist: boolean
    ```
+ ### */api/user/login*
  + 说明：用户登录
  + 参数：

    ```ts
    {
        email: string
        password: string
    }
    ```
  + 返回：
    + **403**：密码错误
+ ### */api/user/getInformation*
  + 说明：获取用户基本信息
  + 参数：其中为true的会在返回中有，默认为false，返回中对应内容为null

    ```ts
    {
        avator?: boolean
        phone?: boolean
        qq?: boolean
        gender? boolean
    }
    ```
  + 返回：

    ```ts
    {
        id: number
        username: string
        administrator: boolean
        email: string
        reputation: number
        joinDate: Date
        dropped: boolean
        //base64编码
        avator?: string
        phone?: number
        qq?: string
        gender?: Gender
    }
    enum Gender{
        Male, Female, Other, Secret
    }
    ```
+ ### */api/user/isAdministrator*
  + 说明：用户是否为管理员
  + 返回：

    ```ts
    boolean
    ```
+ ### */api/user/hasDropped*
  + 说明：用户是否已注销或被永久封禁
  + 返回

    ```ts
    boolean
    ```
+ ### */api/user/hasVotedProblem*
  + 说明：是否对问题投过票
  + 参数：

    ```ts
    id: number
    ```
  + 返回：-1表示投反对，0表示没投，1表示投赞同

    ```ts
    status: -1|0|1
    ```
+ ### */api/user/getLogs*
  + 说明：获取历史记录
  + 参数：结果按两个条件取交集，默认获取最近的10条记录

    ```ts
    {
        //获取的记录条数
        limit?: number
        //截止日期
        date?: Date
    }
    ```

  + 返回：detail的解析会提供一个parser，其中包含针对不同Type的interface

    ```ts
    Array<{
        id: string
        type: LogType
        date: Date
        detail?: string
    }>
    enum LogType {
        Register, Close, Login, Logout, Modify, Donate,
        Judge, Create, Revise, Response, Delete, Vote, Comment,
        Suspend, Terminate, Administrate
    }
    ```
+ ### */api/user/getJudgements*
  + 说明：获取评测记录
  + 参数：结果按两个条件取交集，默认获取最近的10条记录

    ```ts
    {
        //获取的记录条数
        limit?: number
        //截止日期
        date?: Date
    }
    ```

  + 返回：对于自测记录，problemId和problemTitle都为null

    ```ts
    Array<{
        id: number
        problemId?：number
        problemTitle?: string
        result: "Passed"|"Found"
    }>
    ```
+ ### */api/tag/getAll*
  + 说明：获取所有标签
  + 返回：

    ```ts
    Array<{
        id: number
        name: string
    }>
    ```
+ ### */api/tag/getDescription*
  + 说明：获取标签描述
  + 参数：

    ```ts
    id: number
    ```
  + 返回：

    ```ts
    description: string
    ```
+ ### */api/tag/findByIds*
  + 说明：通过id获取标签
  + 参数：

    ```ts
    ids: number[]
    ```
  + 返回：

    ```ts
    Array<{
        id: number
        name: string
    }>
    ```
+ ### */api/tag/findByNames*
  + 说明：通过名称获取标签
  + 参数：

    ```ts
    names: string[]
    ```
  + 返回：

    ```ts
    Array<{
        id: number
        name: string
    }>
    ```
+ ### */api/problem/search*
  + 说明：搜索问题
  + 参数：id和title、tags不能同时有值

    ```ts
    {
        id?: number
        title?: string
        tags?: number[]
    }
    ```
  + 返回：

    ```ts
    Array<{
        id: number
        title: string
        tags: number[]
        creatorId: number
        vote: number
    }>
    ```

## **Post**
场景：向后端添加资源
+ ### */api/user/register*
  + 说明：向数据库中添加用户
  + 负载：

    ```ts
    {
        username: string
        email: string
        phone?: number
        qq?: string
    }
    ```

  + 返回：
    + **201**：创建成功

      ```ts
      id: number
      ```
    + **403**：邮箱验证码错误
+ ### */api/problem/create*
  + 说明：创建题目
  + 负载：

    ```ts
    {
        title: string
        //markdown
        description: string
        tags: number[]
    }
    ```
  
  + 返回：
    + **201**：创建成功

      ```ts
      id: number
      ```
+ ### */api/source/upload*
  + 说明：上传代码
  + 参数：个人评测时参数留空

    ```ts
    problemId?: number
    ```
  + 负载：使用HTML表单
    + uploadedFile
    + language
    + languageStandard
    + compiler
  + 返回：

    ```ts
    id: number
    ```
+ ### */api/judgement/start*
  + 说明：进行评测
  + 负载：

    ```ts
    {
        datamakerId: number
        standardProgramId: number
        judgedProgramId: number
        datamakerArguments?: string
        maxTime: number
    }
    ```
  + 返回：

    ```ts
    judgementId: number
    ```

## Put
场景：修改后端资源
+ ### */api/user/modify*
  + 说明：修改用户信息
  + 负载：

    ```ts
    {
        username?: string
        phone?: number
        qq?: string
        gender?: Gender
        //base64编码
        avator?: string
    }
    enum Gender{
        Male, Female, Other, Secret
    }
    ```
+ ### */api/problem/modify*
  + 说明：创建者修改题目
  + 负载：
  
    ```ts
    {
        title?: string
        description?: number
        tags?: number[]
    }
    ```
+ ### */api/problem/vote*
  + 说明：对问题投票
  + 参数：

    ```ts
    id: number
    ```
  + 负载：默认赞同，false表示反对

    ```ts
    voteup？: boolean
    ```
  + 返回：
    + **409**：冲突，已经投过了

## Delete
场景：删除或关闭后端资源
+ ### */api/user/drop*
  + 说明：注销用户
+ ### */api/problem/close*
  + 说明：关闭题目
  + 参数：

    ```ts
    id: number
    ```